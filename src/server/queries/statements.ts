import "server-only";
import { and, between, eq, inArray, isNotNull, min, ne, or, sql } from "drizzle-orm";
import type { IsoDate, IsoMonth } from "@/lib/calendar";
import type { StatementPeriod } from "@/lib/statement-period";
import type { FixedIncomeMovement, StatementEntry, StatementMovement } from "@/lib/statements";
import { getDb, type DbExecutor } from "@/server/db/client";
import { deposits, ledgerEntries, promoBookings, returnPeriods, withdrawals } from "@/server/db/schema";
import { berlinDate, depositValueDate } from "./accrual";

export type StatementData = { entries: StatementEntry[]; movements: StatementMovement[] };

const isFixedIncome = inArray(ledgerEntries.entryType, ["promo_transfer", "promo_principal_return", "promo_return"]);
const fixedIncomeDay = sql<string>`case when ${ledgerEntries.entryType} = 'promo_transfer'
  then ${berlinDate(promoBookings.processedAt)} else ${berlinDate(ledgerEntries.createdAt)} end`;
const returnValueDate = sql<string>`(${returnPeriods.periodStart} + interval '1 month')::date`;
const withdrawalDay = berlinDate(withdrawals.createdAt);

/**
 * The day a ledger entry counts for the monthly statement (see `src/lib/statements.ts`): a deposit (and its fee or
 * reversal) on its receipt date, a withdrawal (and its fee or refund) on its request date, a return from the 1st of
 * the following month. Needs the ledger joined with deposits, withdrawals and return periods.
 */
const entryValueDate = sql<string>`case
  when ${isFixedIncome} then ${fixedIncomeDay}
  when ${ledgerEntries.returnPeriodId} is not null then ${returnValueDate}
  when ${ledgerEntries.depositId} is not null then ${depositValueDate}
  else ${withdrawalDay}
end`;

/** Accounts with a visible request, Fixed Incomes posting, or earned monthly return in the statement. */
export function accountsWithStatementActivity({ from, to }: StatementPeriod) {
  const db = getDb();
  // The statement displays a monthly return on the last day of its earning month.
  const postingDay = sql<string>`coalesce(${returnValueDate} - 1, ${fixedIncomeDay})`;
  return db.select({ accountId: deposits.accountId }).from(deposits)
    .where(and(ne(deposits.status, "rejected"), between(depositValueDate, from, to)))
    .unionAll(db.select({ accountId: withdrawals.accountId }).from(withdrawals)
      .where(and(ne(withdrawals.status, "rejected"), between(withdrawalDay, from, to))))
    .unionAll(db.select({ accountId: ledgerEntries.accountId }).from(ledgerEntries)
      .leftJoin(returnPeriods, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
      .leftJoin(promoBookings, eq(ledgerEntries.promoBookingId, promoBookings.id))
      .where(and(or(isNotNull(ledgerEntries.returnPeriodId), isFixedIncome), between(postingDay, from, to))));
}

/** Ledger amounts and requests of the given accounts with a value date up to `upTo`, for their monthly statements. */
export async function loadStatementData(
  accountIds: string[],
  upTo: IsoDate,
  executor?: DbExecutor,
): Promise<Map<string, StatementData>> {
  if (accountIds.length === 0) return new Map();
  // The ledger and both request lists must reflect the same moment during concurrent approvals.
  if (!executor) {
    return getDb().transaction((tx) => loadStatementData(accountIds, upTo, tx), {
      isolationLevel: "repeatable read", accessMode: "read only",
    });
  }
  const data = new Map<string, StatementData>(accountIds.map((id) => [id, { entries: [], movements: [] }]));
  const entryRows = await executor
      .select({
        accountId: ledgerEntries.accountId,
        valueDate: sql<string>`to_char(${entryValueDate}, 'YYYY-MM-DD')`,
        returnMonth: sql<string | null>`to_char(${returnPeriods.periodStart}, 'YYYY-MM')`,
        amountCents: sql<number>`sum(${ledgerEntries.amountCents})`.mapWith(Number),
        fixedKind: sql<FixedIncomeMovement | null>`case when ${isFixedIncome} then ${ledgerEntries.entryType} end`,
        fixedReference: sql<string | null>`case when ${isFixedIncome}
          then coalesce(${promoBookings.reference}, ${deposits.reference}, ${ledgerEntries.id}::text) end`,
      })
      .from(ledgerEntries)
      .leftJoin(deposits, eq(ledgerEntries.depositId, deposits.id))
      .leftJoin(withdrawals, eq(ledgerEntries.withdrawalId, withdrawals.id))
      .leftJoin(returnPeriods, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
      .leftJoin(promoBookings, eq(ledgerEntries.promoBookingId, promoBookings.id))
      .where(and(inArray(ledgerEntries.accountId, accountIds), sql`${entryValueDate} <= ${upTo}::date`))
      // By position: the value date contains a bound parameter (the time zone), so repeating the expression here
      // wouldn't match the selected one.
      .groupBy(ledgerEntries.accountId, sql`2`, sql`3`, sql`5`, sql`6`);
  const depositRows = await executor
      .select({
        accountId: deposits.accountId,
        valueDate: sql<string>`to_char(${depositValueDate}, 'YYYY-MM-DD')`,
        amountCents: sql<number>`${deposits.amountCents} - ${deposits.feeCents}`.mapWith(Number),
        reference: deposits.reference,
        status: deposits.status,
        creditedAt: deposits.creditedAt,
      })
      .from(deposits)
      .where(
        and(
          inArray(deposits.accountId, accountIds),
          ne(deposits.status, "rejected"),
          sql`${depositValueDate} <= ${upTo}::date`,
        ),
      );
  const withdrawalRows = await executor
      .select({
        accountId: withdrawals.accountId,
        valueDate: sql<string>`to_char(${withdrawalDay}, 'YYYY-MM-DD')`,
        amountCents: sql<number>`-(${withdrawals.amountCents} + ${withdrawals.feeCents})`.mapWith(Number),
        reference: withdrawals.reference,
        status: withdrawals.status,
        debitedAt: withdrawals.debitedAt,
      })
      .from(withdrawals)
      .where(
        and(
          inArray(withdrawals.accountId, accountIds),
          ne(withdrawals.status, "rejected"),
          sql`${withdrawalDay} <= ${upTo}::date`,
        ),
      );

  for (const row of entryRows) {
    data.get(row.accountId)?.entries.push({
      valueDate: row.valueDate,
      amountCents: row.amountCents,
      returnMonth: row.returnMonth,
    });
    if (row.fixedKind && row.fixedReference) {
      data.get(row.accountId)?.movements.push({
        kind: row.fixedKind, reference: row.fixedReference, valueDate: row.valueDate,
        amountCents: row.amountCents, status: "booked", pending: false, booked: true,
      });
    }
  }
  for (const row of depositRows) {
    data.get(row.accountId)?.movements.push({
      kind: "deposit",
      status: row.status,
      reference: row.reference,
      valueDate: row.valueDate,
      amountCents: row.amountCents,
      pending: row.status === "pending",
      booked: row.creditedAt !== null,
    });
  }
  for (const row of withdrawalRows) {
    data.get(row.accountId)?.movements.push({
      kind: "withdrawal",
      status: row.status,
      reference: row.reference,
      valueDate: row.valueDate,
      amountCents: row.amountCents,
      pending: row.status === "pending",
      booked: row.debitedAt !== null,
    });
  }
  return data;
}

/** Month of the first deposit in the pool (its value date), for the month filter; `null` before any deposit. */
export async function getFirstDepositMonth(executor: DbExecutor = getDb()): Promise<IsoMonth | null> {
  const [row] = await executor
    .select({ firstDay: min(sql<string>`to_char(${depositValueDate}, 'YYYY-MM-DD')`) })
    .from(deposits)
    .where(ne(deposits.status, "rejected"));
  return row?.firstDay ? row.firstDay.slice(0, 7) : null;
}
