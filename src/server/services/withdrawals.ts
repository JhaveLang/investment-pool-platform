import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { todayIsoDate } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { withdrawalFeeCents } from "@/lib/fees";
import { getDb, type DbTransaction } from "@/server/db/client";
import { withdrawals, type Withdrawal, type WithdrawalStatus } from "@/server/db/schema";
import { loadActivePromoStandardReserveCents, loadLockedCapital, loadReservedPayoutCents, loadReservedPromoBookingCents } from "@/server/queries/accrual";
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
 * Requests a payout. Nothing is debited yet: payout and fee are reserved (they can't be
 * requested twice) until an admin approves the request, which debits them, or rejects it,
 * which frees them. Capital still inside the 60-day minimum term can't be withdrawn; returns
 * always can. The requested amount stops earning returns on the day of the request.
 */
export async function requestWithdrawal(input: RequestWithdrawalInput): Promise<Withdrawal & { newlyCreated: boolean }> {
  return getDb().transaction(async (tx) => {
    const account = await lockAccountForUser(tx, input.userId);

    const [existingWithdrawal] = await tx
      .select()
      .from(withdrawals)
      .where(and(eq(withdrawals.accountId, account.id), eq(withdrawals.idempotencyKey, input.idempotencyKey)));
    if (existingWithdrawal) {
      return { ...existingWithdrawal, newlyCreated: false };
    }

    const { destination } = input;
    const feeCents = withdrawalFeeCents(input.amountCents, destination.method);
    const totalDebitCents = input.amountCents + feeCents;
    // The account row is locked, so no concurrent booking can change the balance, the lock or the reservations.
    const reservedCents = await loadReservedPayoutCents(tx, account.id);
    const reservedPromoCents = await loadReservedPromoBookingCents(tx, account.id);
    const promoStandardReserve = await loadActivePromoStandardReserveCents(tx, account.id);
    if (totalDebitCents > account.balanceCents - reservedCents - reservedPromoCents - promoStandardReserve) {
      throw new DomainError("INSUFFICIENT_FUNDS");
    }
    const { lockedCents } = await loadLockedCapital(tx, account.id, todayIsoDate());
    if (totalDebitCents > account.balanceCents - lockedCents - reservedCents - reservedPromoCents - promoStandardReserve) {
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

    return { ...withdrawal, newlyCreated: true };
  });
}

/**
 * Confirms the payout was sent and debits payout and fee (two ledger entries, so the fee stays
 * visible). Requests made before the approval rule were debited at request time and are not
 * debited again.
 */
export async function approveWithdrawal(input: ReviewInput): Promise<number> {
  return getDb().transaction(async (tx) => {
    const [pendingWithdrawal] = await tx
      .select({ debitedAt: withdrawals.debitedAt })
      .from(withdrawals)
      .where(and(eq(withdrawals.id, input.recordId), eq(withdrawals.status, "pending")))
      .for("update");
    if (!pendingWithdrawal) {
      throw new DomainError("ALREADY_PROCESSED");
    }

    const withdrawal = await finalizePendingWithdrawal(tx, input, "approved");
    if (pendingWithdrawal.debitedAt === null) {
      await postLedgerEntry(tx, {
        accountId: withdrawal.accountId,
        entryType: "withdrawal",
        amountCents: -withdrawal.amountCents,
        withdrawalId: withdrawal.id,
        createdByUserId: input.reviewerId,
      });
      if (withdrawal.feeCents > 0) {
        await postLedgerEntry(tx, {
          accountId: withdrawal.accountId,
          entryType: "withdrawal_fee",
          amountCents: -withdrawal.feeCents,
          withdrawalId: withdrawal.id,
          createdByUserId: input.reviewerId,
        });
      }
    }
    return recordAudit(tx, {
      actorUserId: input.reviewerId,
      action: "withdrawal.approved",
      entityType: "withdrawal",
      entityId: withdrawal.id,
      metadata: { amountCents: withdrawal.amountCents, reference: withdrawal.reference, note: input.note },
      ipAddress: input.ipAddress,
    });
  });
}

/**
 * Declines the payout; the reserved amount is free again and nothing is booked. A request made
 * before the approval rule was already debited, so payout and fee are credited back.
 */
export async function rejectWithdrawal(input: ReviewInput): Promise<number> {
  return getDb().transaction(async (tx) => {
    const withdrawal = await finalizePendingWithdrawal(tx, input, "rejected");

    if (withdrawal.debitedAt !== null) {
      await postLedgerEntry(tx, {
        accountId: withdrawal.accountId,
        entryType: "withdrawal_reversal",
        amountCents: debitedCents(withdrawal),
        withdrawalId: withdrawal.id,
        createdByUserId: input.reviewerId,
      });
    }

    return recordAudit(tx, {
      actorUserId: input.reviewerId,
      action: "withdrawal.rejected",
      entityType: "withdrawal",
      entityId: withdrawal.id,
      metadata: { amountCents: withdrawal.amountCents, reference: withdrawal.reference, note: input.note },
      ipAddress: input.ipAddress,
    });
  });
}

/**
 * The `status = 'pending'` condition makes processing a withdrawal twice impossible. Approving
 * stamps `debited_at` in the same statement (the database requires it for approved withdrawals);
 * an earlier stamp from before the approval rule is kept.
 */
async function finalizePendingWithdrawal(
  tx: DbTransaction,
  input: ReviewInput,
  status: Exclude<WithdrawalStatus, "pending">,
): Promise<Withdrawal> {
  const [withdrawal] = await tx
    .update(withdrawals)
    .set({
      status,
      ...(status === "approved" ? { debitedAt: sql`coalesce(${withdrawals.debitedAt}, now())` } : {}),
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
