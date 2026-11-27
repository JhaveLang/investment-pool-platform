import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { IsoDate, IsoMonth } from "@/lib/calendar";
import { getDb } from "@/server/db/client";
import { ledgerEntries, returnPeriods } from "@/server/db/schema";
import { berlinDate } from "./accrual";

/** Running totals at the end of a day with at least one ledger entry. */
export type BalancePoint = {
  day: IsoDate;
  balanceCents: number;
  /** Credited deposits after fees and cancellations, cumulative. */
  depositedCents: number;
  /** Debited withdrawals including fees, after refunds, cumulative (positive). */
  withdrawnCents: number;
  /** Booked monthly returns, cumulative. */
  returnsCents: number;
};

const day = berlinDate(ledgerEntries.createdAt);
const sumOf = (entryTypes: string) =>
  sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.entryType} in (${sql.raw(entryTypes)})), 0)`.mapWith(
    Number,
  );

/**
 * End-of-day balance history, oldest first: one account's, or the whole pool's when
 * `accountId` is omitted. Every money movement is a ledger entry, so the running sum of
 * the daily movements is the balance.
 */
export async function loadBalanceHistory(accountId?: string): Promise<BalancePoint[]> {
  const rows = await getDb()
    .select({
      day: sql<string>`to_char(${day}, 'YYYY-MM-DD')`,
      depositedCents: sumOf("'deposit', 'deposit_fee', 'deposit_reversal', 'promo_principal_return'"),
      withdrawnCents: sumOf("'withdrawal', 'withdrawal_fee', 'withdrawal_reversal', 'promo_transfer'"),
      returnsCents: sumOf("'monthly_return', 'promo_return'"),
    })
    .from(ledgerEntries)
    .where(accountId ? eq(ledgerEntries.accountId, accountId) : undefined)
    // By position: each mention of `day` binds the time zone as its own parameter, so
    // Postgres wouldn't match a repeated expression to the selected one.
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const totals = { depositedCents: 0, withdrawnCents: 0, returnsCents: 0 };
  return rows.map((row) => {
    totals.depositedCents += row.depositedCents;
    totals.withdrawnCents -= row.withdrawnCents;
    totals.returnsCents += row.returnsCents;
    return {
      day: row.day,
      balanceCents: totals.depositedCents - totals.withdrawnCents + totals.returnsCents,
      ...totals,
    };
  });
}

export type MonthlyReturnPoint = {
  month: IsoMonth;
  ratePpm: number;
  /** The account's return for the month, or the pool total when no account is given. */
  amountCents: number;
};

const MONTHLY_RETURN_LIMIT = 12;
const periodMonth = sql<string>`to_char(${returnPeriods.periodStart}, 'YYYY-MM')`;

/** The last twelve booked months, oldest first. Investors see only their own postings. */
export async function listMonthlyReturns(accountId?: string): Promise<MonthlyReturnPoint[]> {
  const db = getDb();
  const rows = accountId
    ? await db
        .select({ month: periodMonth, ratePpm: returnPeriods.ratePpm, amountCents: ledgerEntries.amountCents })
        .from(ledgerEntries)
        .innerJoin(returnPeriods, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
        .where(and(eq(ledgerEntries.accountId, accountId), eq(ledgerEntries.entryType, "monthly_return")))
        .orderBy(desc(returnPeriods.periodStart))
        .limit(MONTHLY_RETURN_LIMIT)
    : await db
        .select({ month: periodMonth, ratePpm: returnPeriods.ratePpm, amountCents: returnPeriods.totalCents })
        .from(returnPeriods)
        .orderBy(desc(returnPeriods.periodStart))
        .limit(MONTHLY_RETURN_LIMIT);
  return rows.reverse();
}

/** The pool's most recently booked month and its result, or `null` before the first booking. */
export async function getLatestReturnRate(): Promise<{ month: IsoMonth; ratePpm: number } | null> {
  const [latest] = await getDb()
    .select({ month: periodMonth, ratePpm: returnPeriods.ratePpm })
    .from(returnPeriods)
    .orderBy(desc(returnPeriods.periodStart))
    .limit(1);
  return latest ?? null;
}
