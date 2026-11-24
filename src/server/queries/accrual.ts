import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { IsoDate } from "@/lib/calendar";
import { APP_TIME_ZONE } from "@/lib/format";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, type CapitalChange, type PausedRange } from "@/lib/returns";
import type { DbExecutor } from "@/server/db/client";
import { accounts, auditLogs, deposits, ledgerEntries, returnPeriods, withdrawals } from "@/server/db/schema";

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

/** Requested but not yet approved, under the approval rule (older requests were debited when they were made). */
const undebitedPendingWithdrawal = and(eq(withdrawals.status, "pending"), isNull(withdrawals.debitedAt));

export type AccountCapitalChange = CapitalChange & { accountId: string };

/**
 * Every account's changes of earning capital up to `periodEnd`, summed per effective day.
 * Changes from before the period are folded into its first day. Withdrawals still awaiting
 * approval are debited only then, but they stop earning from the request day, so they count
 * as changes too.
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

  const ledgerChanges = await executor
    .select({
      accountId: entries.accountId,
      effectiveOn: sql<string>`to_char(${entries.effectiveOn}, 'YYYY-MM-DD')`,
      amountCents: sql<number>`sum(${entries.amountCents})`.mapWith(Number),
    })
    .from(entries)
    .groupBy(entries.accountId, entries.effectiveOn);

  const requestDay = berlinDate(withdrawals.createdAt);
  const pendingPayouts = await executor
    .select({
      accountId: withdrawals.accountId,
      effectiveOn: sql<string>`to_char(greatest(${requestDay}, ${periodStart}::date), 'YYYY-MM-DD')`,
      amountCents: sql<number>`-(${withdrawals.amountCents} + ${withdrawals.feeCents})`.mapWith(Number),
    })
    .from(withdrawals)
    .where(and(undebitedPendingWithdrawal, sql`${requestDay} <= ${periodEnd}::date`));

  return [...ledgerChanges, ...pendingPayouts];
}

/**
 * Payout plus fee of withdrawals awaiting approval. The amount is still in the balance but reserved, so it can't be
 * requested twice and a later approval can always be debited.
 */
export async function loadReservedPayoutCents(executor: DbExecutor, accountId: string): Promise<number> {
  const reserved = await loadReservedPayouts(executor, [accountId]);
  return reserved.get(accountId) ?? 0;
}

/** Reserved payout plus fee per account, for the given accounts. */
export async function loadReservedPayouts(executor: DbExecutor, accountIds: string[]): Promise<Map<string, number>> {
  if (accountIds.length === 0) {
    return new Map();
  }
  const rows = await executor
    .select({
      accountId: withdrawals.accountId,
      reservedCents: sql<number>`sum(${withdrawals.amountCents} + ${withdrawals.feeCents})`.mapWith(Number),
    })
    .from(withdrawals)
    .where(and(undebitedPendingWithdrawal, inArray(withdrawals.accountId, accountIds)))
    .groupBy(withdrawals.accountId);
  return new Map(rows.map((row) => [row.accountId, row.reservedCents]));
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

/**
 * Capital of credited deposits younger than the minimum term; only the rest of the balance can be withdrawn.
 * Deposits awaiting reconciliation aren't in the balance yet, so they lock nothing.
 */
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
    .where(
      and(
        eq(deposits.accountId, accountId),
        ne(deposits.status, "rejected"),
        isNotNull(deposits.creditedAt),
        sql`${unlocksOn} > ${today}::date`,
      ),
    );
  return locked;
}

/**
 * Per account, the days on which the investor was deactivated up to `periodEnd` (see `PausedRange`). Built from the
 * activity log, where every deactivation and activation is written in the same transaction as the status change.
 */
export async function loadPausedRanges(executor: DbExecutor, periodEnd: IsoDate): Promise<Map<string, PausedRange[]>> {
  const changeDay = berlinDate(auditLogs.createdAt);
  const rows = await executor
    .select({
      accountId: accounts.id,
      action: auditLogs.action,
      day: sql<string>`to_char(${changeDay}, 'YYYY-MM-DD')`,
    })
    .from(auditLogs)
    .innerJoin(accounts, sql`${accounts.userId}::text = ${auditLogs.entityId}`)
    .where(
      and(
        eq(auditLogs.entityType, "user"),
        inArray(auditLogs.action, ["user.deactivated", "user.activated"]),
        sql`${changeDay} <= ${periodEnd}::date`,
      ),
    )
    .orderBy(asc(auditLogs.id));

  const ranges = new Map<string, PausedRange[]>();
  const addRange = (accountId: string, range: PausedRange) => {
    const accountRanges = ranges.get(accountId) ?? [];
    accountRanges.push(range);
    ranges.set(accountId, accountRanges);
  };
  const openSince = new Map<string, string>();
  for (const row of rows) {
    const since = openSince.get(row.accountId);
    if (row.action === "user.deactivated" && since === undefined) {
      openSince.set(row.accountId, row.day);
    } else if (row.action === "user.activated" && since !== undefined) {
      addRange(row.accountId, { from: since, until: row.day });
      openSince.delete(row.accountId);
    }
  }
  for (const [accountId, since] of openSince) {
    addRange(accountId, { from: since, until: null });
  }
  return ranges;
}
