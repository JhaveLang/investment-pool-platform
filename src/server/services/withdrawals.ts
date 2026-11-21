import "server-only";
import { and, eq } from "drizzle-orm";
import { todayIsoDate } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { withdrawalFeeCents } from "@/lib/fees";
import { getDb, type DbTransaction } from "@/server/db/client";
import { withdrawals, type Withdrawal, type WithdrawalStatus } from "@/server/db/schema";
import { loadLockedCapital } from "@/server/queries/accrual";
import { recordAudit } from "./audit";
import { generateReference, lockAccountForUser, postLedgerEntry } from "./ledger";
import type { ReviewInput } from "./types";

/** Bank payouts go to an IBAN; crypto and exchange payouts to a wallet address. */
export type PayoutDestination =
  { method: "bank_transfer"; iban: string } | { method: "crypto" | "exchange"; walletAddress: string };

type RequestWithdrawalInput = {
  userId: string;
  /** Amount the investor receives; the fee is debited on top. */
  amountCents: number;
  destination: PayoutDestination;
  idempotencyKey: string;
  ipAddress: string | null;
};

/** Total taken from the balance: payout plus fee. */
function debitedCents(withdrawal: Withdrawal): number {
  return withdrawal.amountCents + withdrawal.feeCents;
}

/**
 * Requests a payout: the payout and its fee are debited immediately (so they can't be
 * withdrawn twice) and the request waits for admin approval. Rejection credits both back.
 * Capital still inside the 60-day minimum term can't be withdrawn; returns always can.
 * The withdrawn amount stops earning returns on the day of the request.
 */
export async function requestWithdrawal(input: RequestWithdrawalInput): Promise<Withdrawal> {
  return getDb().transaction(async (tx) => {
    const account = await lockAccountForUser(tx, input.userId);

    const [existingWithdrawal] = await tx
      .select()
      .from(withdrawals)
      .where(and(eq(withdrawals.accountId, account.id), eq(withdrawals.idempotencyKey, input.idempotencyKey)));
    if (existingWithdrawal) {
      return existingWithdrawal;
    }

    const { destination } = input;
    const feeCents = withdrawalFeeCents(input.amountCents, destination.method);
    const totalDebitCents = input.amountCents + feeCents;
    if (totalDebitCents > account.balanceCents) {
      throw new DomainError("INSUFFICIENT_FUNDS");
    }
    // The account row is locked, so no concurrent booking can change the balance or the lock.
    const { lockedCents } = await loadLockedCapital(tx, account.id, todayIsoDate());
    if (totalDebitCents > account.balanceCents - lockedCents) {
      throw new DomainError("MINIMUM_TERM");
    }

    const [withdrawal] = await tx
      .insert(withdrawals)
      .values({
        accountId: account.id,
        amountCents: input.amountCents,
        method: destination.method,
        feeCents,
        iban: destination.method === "bank_transfer" ? destination.iban : null,
        walletAddress: destination.method === "bank_transfer" ? null : destination.walletAddress,
        idempotencyKey: input.idempotencyKey,
        reference: generateReference("AZ"),
      })
      .returning();

    await postLedgerEntry(tx, {
      accountId: account.id,
      entryType: "withdrawal",
      amountCents: -withdrawal.amountCents,
      withdrawalId: withdrawal.id,
      createdByUserId: input.userId,
    });
    if (withdrawal.feeCents > 0) {
      await postLedgerEntry(tx, {
        accountId: account.id,
        entryType: "withdrawal_fee",
        amountCents: -withdrawal.feeCents,
        withdrawalId: withdrawal.id,
        createdByUserId: input.userId,
      });
    }

    await recordAudit(tx, {
      actorUserId: input.userId,
      action: "withdrawal.requested",
      entityType: "withdrawal",
      entityId: withdrawal.id,
      metadata: {
        amountCents: withdrawal.amountCents,
        method: withdrawal.method,
        feeCents: withdrawal.feeCents,
        reference: withdrawal.reference,
      },
      ipAddress: input.ipAddress,
    });

    return withdrawal;
  });
}

/** Confirms the payout was sent. The balance was already debited at request time. */
export async function approveWithdrawal(input: ReviewInput): Promise<void> {
  await getDb().transaction(async (tx) => {
    const withdrawal = await finalizePendingWithdrawal(tx, input, "approved");
    await recordAudit(tx, {
      actorUserId: input.reviewerId,
      action: "withdrawal.approved",
      entityType: "withdrawal",
      entityId: withdrawal.id,
      metadata: { amountCents: withdrawal.amountCents, reference: withdrawal.reference, note: input.note },
      ipAddress: input.ipAddress,
    });
  });
}

/** Declines the payout and credits the reserved amount (payout plus fee) back to the investor. */
export async function rejectWithdrawal(input: ReviewInput): Promise<void> {
  await getDb().transaction(async (tx) => {
    const withdrawal = await finalizePendingWithdrawal(tx, input, "rejected");

    await postLedgerEntry(tx, {
      accountId: withdrawal.accountId,
      entryType: "withdrawal_reversal",
      amountCents: debitedCents(withdrawal),
      withdrawalId: withdrawal.id,
      createdByUserId: input.reviewerId,
    });

    await recordAudit(tx, {
      actorUserId: input.reviewerId,
      action: "withdrawal.rejected",
      entityType: "withdrawal",
      entityId: withdrawal.id,
      metadata: { amountCents: withdrawal.amountCents, reference: withdrawal.reference, note: input.note },
      ipAddress: input.ipAddress,
    });
  });
}

/** The `status = 'pending'` condition makes processing a withdrawal twice impossible. */
async function finalizePendingWithdrawal(
  tx: DbTransaction,
  input: ReviewInput,
  status: Exclude<WithdrawalStatus, "pending">,
): Promise<Withdrawal> {
  const [withdrawal] = await tx
    .update(withdrawals)
    .set({
      status,
      reviewedAt: new Date(),
      reviewedByUserId: input.reviewerId,
      reviewNote: input.note ?? null,
    })
    .where(and(eq(withdrawals.id, input.recordId), eq(withdrawals.status, "pending")))
    .returning();

  if (!withdrawal) {
    throw new DomainError("ALREADY_PROCESSED");
  }
  return withdrawal;
}
