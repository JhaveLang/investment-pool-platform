import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { daysInMonth, firstDayOfMonth, lastDayOfMonth, todayIsoDate, type IsoMonth } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { calculatePeriodReturn, pausedDaysBetween, sumCapitalDays, type CapitalChange } from "@/lib/returns";
import { getDb, type DbExecutor } from "@/server/db/client";
import { accounts, returnPeriods, users, type ReturnPeriod } from "@/server/db/schema";
import {
  countPendingDepositsEarningBy,
  countPendingWithdrawalsRequestedBy,
  loadActivePromoStandardReserveCents,
  loadCapitalChanges,
  loadLockedPromoCapital,
  loadPausedRanges,
  loadReservedPayouts,
  loadReservedPromoBookings,
} from "@/server/queries/accrual";
import { getReturnSchedule } from "@/server/queries/returns";
import { recordAudit } from "./audit";
import { postLedgerEntries } from "./ledger";

export type MonthlyReturnRow = {
  accountId: string;
  investorName: string;
  investorEmail: string;
  investorCode: string | null;
  /** Day-weighted average capital that earned returns in the month. */
  averageCapitalCents: number;
  /**
   * Amount to book; a loss is capped at the balance minus payouts reserved for pending withdrawals, so approving
   * them later can never overdraw the account.
   */
  returnCents: number;
  /** True when a loss had to be capped because the investor has since withdrawn (or requested a withdrawal). */
  capped: boolean;
  /** Days of the month the investor was deactivated; they earn and lose nothing on those days. */
  pausedDays: number;
};

export type MonthlyReturnCalculation = {
  month: IsoMonth;
  ratePpm: number;
  rows: MonthlyReturnRow[];
  totalCents: number;
  /** Withdrawals from the month still awaiting a decision; they are treated as paid out. */
  pendingWithdrawalCount: number;
};

/** Months are booked once each, in order, after they have ended and once no unreconciled deposit could affect them. */
async function assertBookable(executor: DbExecutor, month: IsoMonth): Promise<void> {
  const [schedule, [alreadyBooked]] = await Promise.all([
    getReturnSchedule(executor),
    executor
      .select({ id: returnPeriods.id })
      .from(returnPeriods)
      .where(eq(returnPeriods.periodStart, firstDayOfMonth(month))),
  ]);
  if (alreadyBooked) {
    throw new DomainError("PERIOD_ALREADY_BOOKED");
  }
  if (!schedule.bookableMonths.includes(month)) {
    throw new DomainError(month > schedule.lastEndedMonth ? "PERIOD_NOT_ENDED" : "PERIOD_OUT_OF_ORDER");
  }
  if ((await countPendingDepositsEarningBy(executor, lastDayOfMonth(month))) > 0) {
    throw new DomainError("UNRECONCILED_DEPOSITS");
  }
}

/**
 * Applies the monthly rate to every account's day-weighted capital (see `src/lib/returns.ts`). Days on which an
 * investor was deactivated count for neither return nor loss.
 */
async function calculateMonthlyReturn(
  executor: DbExecutor,
  month: IsoMonth,
  ratePpm: number,
): Promise<Omit<MonthlyReturnCalculation, "pendingWithdrawalCount">> {
  const periodStart = firstDayOfMonth(month);
  const periodEnd = lastDayOfMonth(month);
  const changes = await loadCapitalChanges(executor, periodStart, periodEnd);

  const changesByAccount = new Map<string, CapitalChange[]>();
  for (const { accountId, ...change } of changes) {
    const accountChanges = changesByAccount.get(accountId) ?? [];
    accountChanges.push(change);
    changesByAccount.set(accountId, accountChanges);
  }
  if (changesByAccount.size === 0) {
    return { month, ratePpm, rows: [], totalCents: 0 };
  }

  const accountRows = await executor
    .select({
      accountId: accounts.id,
      balanceCents: accounts.balanceCents,
      investorName: users.fullName,
      investorEmail: users.email,
      investorCode: users.investorCode,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(inArray(accounts.id, [...changesByAccount.keys()]))
    .orderBy(asc(users.fullName), asc(accounts.id));
  const reservedByAccount = await loadReservedPayouts(
    executor,
    accountRows.map((account) => account.accountId),
  );
  const reservedPromoByAccount = await loadReservedPromoBookings(executor, accountRows.map((account) => account.accountId));
  const promoFloorByAccount = new Map(await Promise.all(accountRows.map(async (account) => [account.accountId, await loadActivePromoStandardReserveCents(executor, account.accountId)] as const)));
  const promoLockedByAccount = await loadLockedPromoCapital(
    executor,
    accountRows.map((account) => account.accountId),
    todayIsoDate(),
  );

  const pausedByAccount = await loadPausedRanges(executor, periodEnd);

  const rows: MonthlyReturnRow[] = [];
  for (const account of accountRows) {
    const paused = pausedByAccount.get(account.accountId) ?? [];
    const capitalDays = sumCapitalDays(changesByAccount.get(account.accountId) ?? [], periodStart, periodEnd, paused);
    const { averageCapitalCents, returnCents } = calculatePeriodReturn(capitalDays, ratePpm, daysInMonth(month));
    if (averageCapitalCents === 0) {
      continue;
    }
    const unreservedCents = Math.max(0, account.balanceCents - (reservedByAccount.get(account.accountId) ?? 0) - (reservedPromoByAccount.get(account.accountId) ?? 0) - (promoFloorByAccount.get(account.accountId) ?? 0));
    const lossCapacity = Math.max(0, unreservedCents - (promoLockedByAccount.get(account.accountId) ?? 0));
    const cappedReturnCents = Math.max(returnCents, -lossCapacity);
    rows.push({
      accountId: account.accountId,
      investorName: account.investorName,
      investorEmail: account.investorEmail,
      investorCode: account.investorCode,
      averageCapitalCents,
      returnCents: cappedReturnCents,
      capped: cappedReturnCents !== returnCents,
      pausedDays: pausedDaysBetween(periodStart, periodEnd, paused),
    });
  }

  return { month, ratePpm, rows, totalCents: rows.reduce((total, row) => total + row.returnCents, 0) };
}

/** What booking the month would post, without changing anything. */
export async function previewMonthlyReturn(month: IsoMonth, ratePpm: number): Promise<MonthlyReturnCalculation> {
  const db = getDb();
  await assertBookable(db, month);
  const [calculation, pendingWithdrawalCount] = await Promise.all([
    calculateMonthlyReturn(db, month, ratePpm),
    countPendingWithdrawalsRequestedBy(db, lastDayOfMonth(month)),
  ]);
  return { ...calculation, pendingWithdrawalCount };
}

type BookMonthlyReturnInput = {
  month: IsoMonth;
  ratePpm: number;
  /** Total of the preview the admin confirmed; booking stops if the data changed since. */
  expectedTotalCents: number;
  adminUserId: string;
  ipAddress: string | null;
};

/**
 * Books the month's result: one `monthly_return` entry per account with a non-zero return,
 * all in one transaction. Bookings are serialised by an advisory lock, and every account
 * row is locked in id order, so balances can't change between calculation and posting.
 */
export async function bookMonthlyReturn(input: BookMonthlyReturnInput): Promise<ReturnPeriod & { auditLogId: number }> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('return_periods'))`);
    await assertBookable(tx, input.month);
    await tx.select({ id: accounts.id }).from(accounts).orderBy(asc(accounts.id)).for("update");

    const calculation = await calculateMonthlyReturn(tx, input.month, input.ratePpm);
    if (calculation.totalCents !== input.expectedTotalCents) {
      throw new DomainError("PREVIEW_OUTDATED");
    }
    const postings = calculation.rows
      .filter((row) => row.returnCents !== 0)
      .sort((left, right) => left.accountId.localeCompare(right.accountId));

    const [period] = await tx
      .insert(returnPeriods)
      .values({
        periodStart: firstDayOfMonth(input.month),
        ratePpm: input.ratePpm,
        totalCents: calculation.totalCents,
        accountCount: postings.length,
        createdByUserId: input.adminUserId,
      })
      .returning();

    await postLedgerEntries(
      tx,
      postings.map((posting) => ({
        accountId: posting.accountId,
        entryType: "monthly_return",
        amountCents: posting.returnCents,
        returnPeriodId: period.id,
        createdByUserId: input.adminUserId,
      })),
    );

    const auditLogId = await recordAudit(tx, {
      actorUserId: input.adminUserId,
      action: "returns.booked",
      entityType: "return_period",
      entityId: period.id,
      metadata: {
        month: input.month,
        ratePpm: input.ratePpm,
        totalCents: period.totalCents,
        accountCount: period.accountCount,
        cappedAccountIds: postings.filter((posting) => posting.capped).map((posting) => posting.accountId),
      },
      ipAddress: input.ipAddress,
    });

    return { ...period, auditLogId };
  });
}
