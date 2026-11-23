import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { todayIsoDate, type IsoDate } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { accounts, deposits, ledgerEntries, withdrawals } from "@/server/db/schema";
import { loadLockedCapital, loadReservedPayoutCents } from "./accrual";

export type AccountOverview = {
  accountId: string;
  balanceCents: number;
  /** Credited deposits after fees and cancellations. */
  totalDepositedCents: number;
  /** Debited withdrawals including fees, after rejections. */
  totalWithdrawnCents: number;
  /** Booked monthly returns (negative months included). */
  totalReturnsCents: number;
  /** Payout plus fee of requests still under review. */
  pendingWithdrawalCents: number;
  /** The part of that still in the balance: reserved until the admin approves (debits) or rejects (frees) it. */
  reservedCents: number;
  /** Amount after fee of deposits awaiting reconciliation; credited to the balance once reconciled. */
  pendingDepositCents: number;
  /** Deposited capital still inside its 60-day minimum term. */
  lockedCents: number;
  nextUnlockOn: IsoDate | null;
  /** What can be withdrawn right now: the balance minus locked capital and reserved payouts. */
  availableCents: number;
};

export async function getAccountOverview(userId: string): Promise<AccountOverview> {
  const db = getDb();
  const [account] = await db
    .select({ id: accounts.id, balanceCents: accounts.balanceCents })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!account) {
    throw new DomainError("ACCOUNT_MISSING");
  }

  const [[ledgerTotals], [pendingTotals], [pendingDeposits], reservedCents, lockedCapital] = await Promise.all([
    db
      .select({
        depositedCents:
          sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.entryType} in ('deposit', 'deposit_fee', 'deposit_reversal')), 0)`.mapWith(
            Number,
          ),
        withdrawnCents:
          sql<number>`coalesce(-sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.entryType} in ('withdrawal', 'withdrawal_fee', 'withdrawal_reversal')), 0)`.mapWith(
            Number,
          ),
        returnsCents:
          sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.entryType} = 'monthly_return'), 0)`.mapWith(
            Number,
          ),
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.accountId, account.id)),
    db
      .select({
        pendingCents: sql<number>`coalesce(sum(${withdrawals.amountCents} + ${withdrawals.feeCents}), 0)`.mapWith(
          Number,
        ),
      })
      .from(withdrawals)
      .where(and(eq(withdrawals.accountId, account.id), eq(withdrawals.status, "pending"))),
    db
      .select({
        pendingCents: sql<number>`coalesce(sum(${deposits.amountCents} - ${deposits.feeCents}), 0)`.mapWith(Number),
      })
      .from(deposits)
      .where(and(eq(deposits.accountId, account.id), eq(deposits.status, "pending"), isNull(deposits.creditedAt))),
    loadReservedPayoutCents(db, account.id),
    loadLockedCapital(db, account.id, todayIsoDate()),
  ]);

  return {
    accountId: account.id,
    balanceCents: account.balanceCents,
    totalDepositedCents: ledgerTotals.depositedCents,
    totalWithdrawnCents: ledgerTotals.withdrawnCents,
    totalReturnsCents: ledgerTotals.returnsCents,
    pendingWithdrawalCents: pendingTotals.pendingCents,
    reservedCents,
    pendingDepositCents: pendingDeposits.pendingCents,
    lockedCents: lockedCapital.lockedCents,
    nextUnlockOn: lockedCapital.nextUnlockOn,
    availableCents: Math.max(0, account.balanceCents - lockedCapital.lockedCents - reservedCents),
  };
}

const RECENT_REQUESTS_LIMIT = 10;

/** The investor's deposits, newest first (10 for the investor's own pages unless asked otherwise). */
/** Whether the investor has ever started a deposit (in any status). */
export async function hasDeposit(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: deposits.id })
    .from(deposits)
    .innerJoin(accounts, eq(deposits.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .limit(1);
  return row !== undefined;
}

export async function listRecentDeposits(userId: string, limit = RECENT_REQUESTS_LIMIT) {
  return getDb()
    .select({
      id: deposits.id,
      createdAt: deposits.createdAt,
      amountCents: deposits.amountCents,
      method: deposits.method,
      feeCents: deposits.feeCents,
      reference: deposits.reference,
      status: deposits.status,
      receivedOn: deposits.receivedOn,
    })
    .from(deposits)
    .innerJoin(accounts, eq(deposits.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .orderBy(desc(deposits.createdAt))
    .limit(limit);
}

export type RecentDeposit = Awaited<ReturnType<typeof listRecentDeposits>>[number];

/** The investor's withdrawal requests, newest first (10 for the investor's own pages unless asked otherwise). */
export async function listRecentWithdrawals(userId: string, limit = RECENT_REQUESTS_LIMIT) {
  return getDb()
    .select({
      id: withdrawals.id,
      createdAt: withdrawals.createdAt,
      amountCents: withdrawals.amountCents,
      method: withdrawals.method,
      feeCents: withdrawals.feeCents,
      reference: withdrawals.reference,
      iban: withdrawals.iban,
      walletAddress: withdrawals.walletAddress,
      status: withdrawals.status,
      reviewNote: withdrawals.reviewNote,
    })
    .from(withdrawals)
    .innerJoin(accounts, eq(withdrawals.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .orderBy(desc(withdrawals.createdAt))
    .limit(limit);
}

export type RecentWithdrawal = Awaited<ReturnType<typeof listRecentWithdrawals>>[number];
