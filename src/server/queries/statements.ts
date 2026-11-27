import "server-only";
import { and, eq, inArray, min, ne, sql } from "drizzle-orm";
import type { IsoDate, IsoMonth } from "@/lib/calendar";
import type { StatementEntry, StatementMovement } from "@/lib/statements";
import { getDb, type DbExecutor } from "@/server/db/client";
import { deposits, ledgerEntries, promoBookings, returnPeriods, withdrawals } from "@/server/db/schema";
import { berlinDate, depositValueDate } from "./accrual";

export type StatementData = { entries: StatementEntry[]; movements: StatementMovement[] };

/**
 * The day a ledger entry counts for the monthly statement (see `src/lib/statements.ts`): a deposit (and its fee or
 * reversal) on its receipt date, a withdrawal (and its fee or refund) on its request date, a return from the 1st of
 * the following month. Needs the ledger joined with deposits, withdrawals and return periods.
 */
const entryValueDate = sql<string>`case
  when ${ledgerEntries.entryType} = 'promo_return' then ${berlinDate(ledgerEntries.createdAt)}
  when ${ledgerEntries.entryType} = 'promo_principal_return' then ${berlinDate(ledgerEntries.createdAt)}
  when ${ledgerEntries.entryType} = 'promo_transfer' then ${berlinDate(promoBookings.processedAt)}
  when ${ledgerEntries.returnPeriodId} is not null then (${returnPeriods.periodStart} + interval '1 month')::date
  when ${ledgerEntries.depositId} is not null then ${depositValueDate}
  else ${berlinDate(withdrawals.createdAt)}
end`;

/** Ledger amounts and requests of the given accounts with a value date up to `upTo`, for their monthly statements. */
export async function loadStatementData(
  accountIds: string[],
  upTo: IsoDate,
  executor: DbExecutor = getDb(),
): Promise<Map<string, StatementData>> {
  const data = new Map<string, StatementData>(accountIds.map((id) => [id, { entries: [], movements: [] }]));
  if (accountIds.length === 0) {
    return data;
  }
  const requestDay = berlinDate(withdrawals.createdAt);
  const [entryRows, depositRows, withdrawalRows] = await Promise.all([
    executor
      .select({
        accountId: ledgerEntries.accountId,
        valueDate: sql<string>`to_char(${entryValueDate}, 'YYYY-MM-DD')`,
        returnMonth: sql<string | null>`coalesce(to_char(${returnPeriods.periodStart}, 'YYYY-MM'), case when ${ledgerEntries.entryType} = 'promo_return' then to_char(${berlinDate(ledgerEntries.createdAt)}, 'YYYY-MM') end)`,
        amountCents: sql<number>`sum(${ledgerEntries.amountCents})`.mapWith(Number),
      })
      .from(ledgerEntries)
      .leftJoin(deposits, eq(ledgerEntries.depositId, deposits.id))
      .leftJoin(withdrawals, eq(ledgerEntries.withdrawalId, withdrawals.id))
      .leftJoin(returnPeriods, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
      .leftJoin(promoBookings, eq(ledgerEntries.promoBookingId, promoBookings.id))
      .where(and(inArray(ledgerEntries.accountId, accountIds), sql`${entryValueDate} <= ${upTo}::date`))
      // By position: the value date contains a bound parameter (the time zone), so repeating the expression here
      // wouldn't match the selected one.
      .groupBy(ledgerEntries.accountId, sql`2`, sql`3`),
    executor
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
      ),
    executor
      .select({
        accountId: withdrawals.accountId,
        valueDate: sql<string>`to_char(${requestDay}, 'YYYY-MM-DD')`,
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
          sql`${requestDay} <= ${upTo}::date`,
        ),
      ),
  ]);

  for (const row of entryRows) {
    data.get(row.accountId)?.entries.push({
      valueDate: row.valueDate,
      amountCents: row.amountCents,
      returnMonth: row.returnMonth,
    });
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
