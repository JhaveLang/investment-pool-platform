import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { todayIsoDate, type IsoDate } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { accounts, deposits, ledgerEntries, withdrawals } from "@/server/db/schema";
import { loadLockedCapital } from "./accrual";

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
  /** Deposited capital still inside its 60-day minimum term. */
  lockedCents: number;
  nextUnlockOn: IsoDate | null;
  /** What can be withdrawn right now: the balance minus locked capital. */
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

  const [[ledgerTotals], [pendingTotals], lockedCapital] = await Promise.all([
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
    loadLockedCapital(db, account.id, todayIsoDate()),
  ]);

  return {
    accountId: account.id,
    balanceCents: account.balanceCents,
    totalDepositedCents: ledgerTotals.depositedCents,
    totalWithdrawnCents: ledgerTotals.withdrawnCents,
    totalReturnsCents: ledgerTotals.returnsCents,
    pendingWithdrawalCents: pendingTotals.pendingCents,
    lockedCents: lockedCapital.lockedCents,
    nextUnlockOn: lockedCapital.nextUnlockOn,
    availableCents: Math.max(0, account.balanceCents - lockedCapital.lockedCents),
  };
}

const RECENT_REQUESTS_LIMIT = 10;

export async function listRecentDeposits(userId: string) {
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
    .limit(RECENT_REQUESTS_LIMIT);
}

export type RecentDeposit = Awaited<ReturnType<typeof listRecentDeposits>>[number];

export async function listRecentWithdrawals(userId: string) {
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
    .limit(RECENT_REQUESTS_LIMIT);
}

export type RecentWithdrawal = Awaited<ReturnType<typeof listRecentWithdrawals>>[number];
