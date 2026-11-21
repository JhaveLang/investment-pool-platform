import "server-only";
import { and, eq } from "drizzle-orm";
import { todayIsoDate, type IsoDate } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { depositFeeCents, type PaymentMethod } from "@/lib/fees";
import { formatIsoDate } from "@/lib/format";
import { getDb, type DbTransaction } from "@/server/db/client";
import { deposits, type Deposit, type DepositStatus } from "@/server/db/schema";
import { recordAudit } from "./audit";
import { generateReference, lockAccountForUser, postLedgerEntry } from "./ledger";
import type { ReviewInput } from "./types";

type CreateDepositInput = {
  userId: string;
  amountCents: number;
  method: PaymentMethod;
  idempotencyKey: string;
  ipAddress: string | null;
};

type ReconcileDepositInput = ReviewInput & {
  /** Day the payment arrived; returns accrue from 7 days after it. */
  receivedOn: IsoDate;
};

/** Credited amount of a deposit: what was sent minus the payment method's fee. */
function creditedCents(deposit: Deposit): number {
  return deposit.amountCents - deposit.feeCents;
}

/**
 * Books a deposit: the investor's balance is credited immediately with the amount minus
 * the payment method's fee (two ledger entries, so the fee stays visible), and the deposit
 * waits in "pending" until an admin reconciles it with the actual receipt date.
 * Re-submitting the same form (same idempotency key) returns the original deposit.
 */
export async function createDeposit(input: CreateDepositInput): Promise<Deposit> {
  return getDb().transaction(async (tx) => {
    const account = await lockAccountForUser(tx, input.userId);

    const [existingDeposit] = await tx
      .select()
      .from(deposits)
      .where(and(eq(deposits.accountId, account.id), eq(deposits.idempotencyKey, input.idempotencyKey)));
    if (existingDeposit) {
      return existingDeposit;
    }

    const [deposit] = await tx
      .insert(deposits)
      .values({
        accountId: account.id,
        amountCents: input.amountCents,
        method: input.method,
        feeCents: depositFeeCents(input.amountCents, input.method),
        idempotencyKey: input.idempotencyKey,
        reference: generateReference("EZ"),
      })
      .returning();

    await postLedgerEntry(tx, {
      accountId: account.id,
      entryType: "deposit",
      amountCents: deposit.amountCents,
      depositId: deposit.id,
      createdByUserId: input.userId,
    });
    if (deposit.feeCents > 0) {
      await postLedgerEntry(tx, {
        accountId: account.id,
        entryType: "deposit_fee",
        amountCents: -deposit.feeCents,
        depositId: deposit.id,
        createdByUserId: input.userId,
      });
    }

    await recordAudit(tx, {
      actorUserId: input.userId,
      action: "deposit.created",
      entityType: "deposit",
      entityId: deposit.id,
      metadata: {
        amountCents: deposit.amountCents,
        method: deposit.method,
        feeCents: deposit.feeCents,
        reference: deposit.reference,
      },
      ipAddress: input.ipAddress,
    });

    return deposit;
  });
}

/**
 * Marks a pending deposit as received and records the receipt day, which starts the 7-day
 * accrual delay and the 60-day minimum term. No money moves.
 *
 * The receipt day can't precede the booking day. Booking a month refuses to run while a
 * deposit that could earn in it is still pending, so a deposit reconciled afterwards always
 * starts earning after every booked month.
 */
export async function reconcileDeposit(input: ReconcileDepositInput): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [pendingDeposit] = await tx
      .select({ createdAt: deposits.createdAt })
      .from(deposits)
      .where(and(eq(deposits.id, input.recordId), eq(deposits.status, "pending")))
      .for("update");
    if (!pendingDeposit) {
      throw new DomainError("ALREADY_PROCESSED");
    }
    if (input.receivedOn < formatIsoDate(pendingDeposit.createdAt) || input.receivedOn > todayIsoDate()) {
      throw new DomainError("INVALID_RECEIPT_DATE");
    }

    const deposit = await finalizePendingDeposit(tx, input, "reconciled", input.receivedOn);
    await recordAudit(tx, {
      actorUserId: input.reviewerId,
      action: "deposit.reconciled",
      entityType: "deposit",
      entityId: deposit.id,
      metadata: {
        amountCents: deposit.amountCents,
        reference: deposit.reference,
        receivedOn: deposit.receivedOn,
        note: input.note,
      },
      ipAddress: input.ipAddress,
    });
  });
}

/**
 * Cancels a deposit whose funds never arrived by reversing the credited amount (deposit
 * minus fee) in one entry. Fails with INSUFFICIENT_FUNDS if the money has already moved.
 */
export async function rejectDeposit(input: ReviewInput): Promise<void> {
  await getDb().transaction(async (tx) => {
    const deposit = await finalizePendingDeposit(tx, input, "rejected");

    await postLedgerEntry(tx, {
      accountId: deposit.accountId,
      entryType: "deposit_reversal",
      amountCents: -creditedCents(deposit),
      depositId: deposit.id,
      createdByUserId: input.reviewerId,
    });

    await recordAudit(tx, {
      actorUserId: input.reviewerId,
      action: "deposit.rejected",
      entityType: "deposit",
      entityId: deposit.id,
      metadata: { amountCents: deposit.amountCents, reference: deposit.reference, note: input.note },
      ipAddress: input.ipAddress,
    });
  });
}

/** The `status = 'pending'` condition makes processing a deposit twice impossible. */
async function finalizePendingDeposit(
  tx: DbTransaction,
  input: ReviewInput,
  status: Exclude<DepositStatus, "pending">,
  receivedOn: IsoDate | null = null,
): Promise<Deposit> {
  const [deposit] = await tx
    .update(deposits)
    .set({
      status,
      receivedOn,
      reviewedAt: new Date(),
      reviewedByUserId: input.reviewerId,
      reviewNote: input.note ?? null,
    })
    .where(and(eq(deposits.id, input.recordId), eq(deposits.status, "pending")))
    .returning();

  if (!deposit) {
    throw new DomainError("ALREADY_PROCESSED");
  }
  return deposit;
}
