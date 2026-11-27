import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { todayIsoDate, type IsoDate } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { depositFeeCents, type PaymentMethod } from "@/lib/fees";
import { formatIsoDate } from "@/lib/format";
import { getDb, type DbTransaction } from "@/server/db/client";
import { accounts, deposits, type Deposit, type DepositStatus } from "@/server/db/schema";
import { loadActivePromoStandardReserveCents, loadReservedPayoutCents, loadReservedPromoBookingCents } from "@/server/queries/accrual";
import { getPoolSettings } from "@/server/queries/pool-settings";
import { recordAudit } from "./audit";
import { generateReference, lockAccountForUser, postLedgerEntry } from "./ledger";
import type { ReviewInput } from "./types";

type CreateDepositInput = {
  userId: string;
  amountCents: number;
  method: PaymentMethod;
  idempotencyKey: string;
  promoOfferId?: string | null;
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
 * Records a deposit the investor has sent. It waits in "pending" until an admin reconciles it
 * with the actual receipt date; only then is the balance credited (see `reconcileDeposit`).
 * Re-submitting the same form (same idempotency key) returns the original deposit. Closed by the
 * admin, the pool takes none.
 */
export async function createDeposit(input: CreateDepositInput): Promise<Deposit & { newlyCreated: boolean }> {
  return getDb().transaction(async (tx) => {
    const account = await lockAccountForUser(tx, input.userId);

    const [existingDeposit] = await tx
      .select()
      .from(deposits)
      .where(and(eq(deposits.accountId, account.id), eq(deposits.idempotencyKey, input.idempotencyKey)));
    if (existingDeposit) {
      return { ...existingDeposit, newlyCreated: false };
    }
    if (!(await getPoolSettings(tx)).depositsOpen) {
      throw new DomainError("DEPOSITS_CLOSED");
    }
    if (input.promoOfferId) throw new DomainError("PROMO_NOT_BOOKABLE");

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

    await recordAudit(tx, {
      actorUserId: input.userId,
      action: "deposit.created",
      entityType: "deposit",
      entityId: deposit.id,
      metadata: {
        amountCents: deposit.amountCents,
        method: deposit.method,
        feeCents: deposit.feeCents,
        promoOfferId: deposit.promoOfferId,
        reference: deposit.reference,
      },
      ipAddress: input.ipAddress,
    });

    return { ...deposit, newlyCreated: true };
  });
}

/**
 * Marks a pending deposit as received, records the receipt day (which starts the 7-day accrual
 * delay and the 60-day minimum term) and credits the balance: the amount and the payment
 * method's fee as two ledger entries, so the fee stays visible. Deposits submitted before the
 * approval rule were credited at submission and are not credited again.
 *
 * The receipt day can't precede the booking day. Booking a month refuses to run while a
 * deposit that could earn in it is still pending, so a deposit reconciled afterwards always
 * starts earning after every booked month.
 */
export async function reconcileDeposit(input: ReconcileDepositInput): Promise<number> {
  return getDb().transaction(async (tx) => {
    const [pendingDeposit] = await tx
      .select({ createdAt: deposits.createdAt, creditedAt: deposits.creditedAt })
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
    if (pendingDeposit.creditedAt === null) {
      await postLedgerEntry(tx, {
        accountId: deposit.accountId,
        entryType: "deposit",
        amountCents: deposit.amountCents,
        depositId: deposit.id,
        createdByUserId: input.reviewerId,
      });
      if (deposit.feeCents > 0) {
        await postLedgerEntry(tx, {
          accountId: deposit.accountId,
          entryType: "deposit_fee",
          amountCents: -deposit.feeCents,
          depositId: deposit.id,
          createdByUserId: input.reviewerId,
        });
      }
    }
    return recordAudit(tx, {
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
 * Cancels a deposit whose funds never arrived. Nothing was credited, so nothing is booked.
 * A deposit submitted before the approval rule was already credited: its credited amount
 * (deposit minus fee) is reversed in one entry, which fails with INSUFFICIENT_FUNDS if that
 * money has been withdrawn or is reserved for a withdrawal or fixed income investment.
 */
export async function rejectDeposit(input: ReviewInput): Promise<number> {
  return getDb().transaction(async (tx) => {
    const deposit = await finalizePendingDeposit(tx, input, "rejected");

    if (deposit.creditedAt !== null) {
      const [account] = await tx
        .select({ balanceCents: accounts.balanceCents })
        .from(accounts)
        .where(eq(accounts.id, deposit.accountId))
        .for("update");
      const reservedPayoutCents = await loadReservedPayoutCents(tx, deposit.accountId);
      const pendingTransferCents = await loadReservedPromoBookingCents(tx, deposit.accountId);
      const standardReserveCents = await loadActivePromoStandardReserveCents(tx, deposit.accountId);
      if (account.balanceCents - creditedCents(deposit) < reservedPayoutCents + pendingTransferCents + standardReserveCents) {
        throw new DomainError("INSUFFICIENT_FUNDS");
      }
      await postLedgerEntry(tx, {
        accountId: deposit.accountId,
        entryType: "deposit_reversal",
        amountCents: -creditedCents(deposit),
        depositId: deposit.id,
        createdByUserId: input.reviewerId,
      });
    }

    return recordAudit(tx, {
      actorUserId: input.reviewerId,
      action: "deposit.rejected",
      entityType: "deposit",
      entityId: deposit.id,
      metadata: { amountCents: deposit.amountCents, reference: deposit.reference, note: input.note },
      ipAddress: input.ipAddress,
    });
  });
}

/**
 * The `status = 'pending'` condition makes processing a deposit twice impossible. Reconciling
 * stamps `credited_at` in the same statement (the database requires it for reconciled deposits);
 * an earlier stamp from before the approval rule is kept.
 */
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
      ...(status === "reconciled" ? { creditedAt: sql`coalesce(${deposits.creditedAt}, now())` } : {}),
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
