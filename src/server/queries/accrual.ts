import "server-only";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { IsoDate } from "@/lib/calendar";
import { APP_TIME_ZONE } from "@/lib/format";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, type CapitalChange } from "@/lib/returns";
import type { DbExecutor } from "@/server/db/client";
import { deposits, ledgerEntries, returnPeriods, withdrawals } from "@/server/db/schema";

// SQL counterparts of the rules in `src/lib/returns.ts`. The day counts are code constants,
// inlined as literals so Postgres can resolve `date + integer`.

/** Calendar day in Berlin time on which a timestamp falls. */
export function berlinDate(column: AnyPgColumn): SQL<string> {
  return sql<string>`(${column} at time zone ${APP_TIME_ZONE})::date`;
}

/** Receipt day of a deposit; until it is reconciled, the day it was booked. */
export const depositValueDate = sql<string>`coalesce(${deposits.receivedOn}, ${berlinDate(deposits.createdAt)})`;

/**
 * First day on which a ledger entry changes the earning capital. Fees and reversals share the
 * day of their deposit or withdrawal, so a cancelled deposit or rejected withdrawal nets to
 * zero. A month's return earns from the first day of the following month (compounding).
 * Needs the ledger joined with deposits, withdrawals and return periods.
 */
const accrualStart = sql<string>`case
  when ${ledgerEntries.returnPeriodId} is not null then (${returnPeriods.periodStart} + interval '1 month')::date
  when ${ledgerEntries.depositId} is not null then ${depositValueDate} + ${sql.raw(String(ACCRUAL_DELAY_DAYS))}
  else ${berlinDate(withdrawals.createdAt)}
end`;

export type AccountCapitalChange = CapitalChange & { accountId: string };

/**
 * Every account's changes of earning capital up to `periodEnd`, summed per effective day.
 * Changes from before the period are folded into its first day.
 */
export async function loadCapitalChanges(
  executor: DbExecutor,
  periodStart: IsoDate,
  periodEnd: IsoDate,
): Promise<AccountCapitalChange[]> {
  const entries = executor
    .select({
      accountId: ledgerEntries.accountId,
      effectiveOn: sql<string>`greatest(${accrualStart}, ${periodStart}::date)`.as("effective_on"),
      amountCents: ledgerEntries.amountCents,
    })
    .from(ledgerEntries)
    .leftJoin(deposits, eq(ledgerEntries.depositId, deposits.id))
    .leftJoin(withdrawals, eq(ledgerEntries.withdrawalId, withdrawals.id))
    .leftJoin(returnPeriods, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
    .where(sql`${accrualStart} <= ${periodEnd}::date`)
    .as("entries");

  return executor
    .select({
      accountId: entries.accountId,
      effectiveOn: sql<string>`to_char(${entries.effectiveOn}, 'YYYY-MM-DD')`,
      amountCents: sql<number>`sum(${entries.amountCents})`.mapWith(Number),
    })
    .from(entries)
    .groupBy(entries.accountId, entries.effectiveOn);
}

/**
 * Pending deposits that would already earn by `date` if they had arrived on their booking
 * day. Their receipt day is still unknown, so a month ending on or after `date` can't be
 * calculated until they are reconciled or cancelled.
 */
export async function countPendingDepositsEarningBy(executor: DbExecutor, date: IsoDate): Promise<number> {
  return executor.$count(
    deposits,
    and(
      eq(deposits.status, "pending"),
      sql`${berlinDate(deposits.createdAt)} + ${sql.raw(String(ACCRUAL_DELAY_DAYS))} <= ${date}::date`,
    ),
  );
}

/**
 * Withdrawals requested by `date` that are still awaiting a decision. They count as paid
 * out; if one is rejected after its month was booked, that month is not recalculated.
 */
export async function countPendingWithdrawalsRequestedBy(executor: DbExecutor, date: IsoDate): Promise<number> {
  return executor.$count(
    withdrawals,
    and(eq(withdrawals.status, "pending"), sql`${berlinDate(withdrawals.createdAt)} <= ${date}::date`),
  );
}

export type LockedCapital = {
  /** Credited deposit amounts still inside their 60-day minimum term. */
  lockedCents: number;
  /** Day the next locked deposit becomes withdrawable, or `null` if nothing is locked. */
  nextUnlockOn: IsoDate | null;
};

/** Capital of deposits younger than the minimum term; only the rest of the balance can be withdrawn. */
export async function loadLockedCapital(
  executor: DbExecutor,
  accountId: string,
  today: IsoDate,
): Promise<LockedCapital> {
  const unlocksOn = sql`${depositValueDate} + ${sql.raw(String(MINIMUM_TERM_DAYS))}`;
  const [locked] = await executor
    .select({
      lockedCents: sql<number>`coalesce(sum(${deposits.amountCents} - ${deposits.feeCents}), 0)`.mapWith(Number),
      nextUnlockOn: sql<string | null>`to_char(min(${unlocksOn}), 'YYYY-MM-DD')`,
    })
    .from(deposits)
    .where(and(eq(deposits.accountId, accountId), ne(deposits.status, "rejected"), sql`${unlocksOn} > ${today}::date`));
  return locked;
}
