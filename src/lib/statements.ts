import type { DepositStatus, WithdrawalStatus } from "@/server/db/schema";
import { addMonths, lastDayOfMonth, monthOf, type IsoDate, type IsoMonth } from "./calendar";
import type { StatementPeriod } from "./statement-period";

/**
 * Monthly statement per investor, in the pool's month-end convention: the investment on the 1st, the month's return
 * and all its booked movements ("Sonstiges"). A deposit counts on its receipt date, a withdrawal on its request
 * date, and fixed-income transfers and payouts on their posting dates. The booked monthly result carries forward
 * into the next month's opening. The ledger provides the closing balance independently of the itemized requests.
 */

/** Booked ledger amounts summed per value date (and per return month for returns). */
export type StatementEntry = {
  valueDate: IsoDate;
  amountCents: number;
  /** For monthly returns: the month the return was earned in. */
  returnMonth: IsoMonth | null;
};

export type FixedIncomeMovement = "promo_transfer" | "promo_principal_return" | "promo_return";

/** A request or fixed-income posting listed under "Sonstiges", with its net effect on the balance. */
export type StatementMovement = (
  { kind: "deposit"; status: DepositStatus } | { kind: "withdrawal"; status: WithdrawalStatus }
  | { kind: FixedIncomeMovement; status: "booked" }
) & {
  /** The request's reference, e.g. "EZ-3VX5PAEY". */
  reference: string;
  valueDate: IsoDate;
  /** Deposit: credited amount after fee (positive). Withdrawal: payout plus fee (negative). */
  amountCents: number;
  /** Still awaiting the admin's decision. */
  pending: boolean;
  /** Already in the ledger (approved, or booked at submission before the approval rule). */
  booked: boolean;
};

export type StatementFigures = {
  /** Balance before the first day; null before the first booking. */
  openingCents: number | null;
  /** Opening plus all ledger postings attributed to this month, including the booked monthly result. */
  closingCents: number | null;
  /** The month's return once booked, else `null`. */
  returnCents: number | null;
  /** Requests and fixed-income postings, newest first (cancelled and rejected requests are left out). */
  movements: StatementMovement[];
};

/** Ledger closing balance minus the opening, booked monthly return and itemized booked movements. */
export function statementVarianceCents(statement: StatementFigures): number {
  const bookedMovements = statement.movements.reduce((sum, movement) => sum + (movement.booked ? movement.amountCents : 0), 0);
  return (statement.closingCents ?? 0) - (statement.openingCents ?? 0) - (statement.returnCents ?? 0) - bookedMovements;
}

export type MonthStatement = StatementFigures & { month: IsoMonth };

/** Attribute booked monthly returns to the last day of the earning month, consistent with the next opening. */
export function buildPeriodStatement(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
  { from, to }: StatementPeriod,
): StatementFigures {
  let openingCents: number | null = null;
  let closingCents: number | null = null;
  let returnCents: number | null = null;
  for (const entry of entries) {
    const day = entry.returnMonth ? lastDayOfMonth(entry.returnMonth) : entry.valueDate;
    if (day > to) continue;
    closingCents = (closingCents ?? 0) + entry.amountCents;
    if (day < from) openingCents = (openingCents ?? 0) + entry.amountCents;
    else if (entry.returnMonth) returnCents = (returnCents ?? 0) + entry.amountCents;
  }
  return {
    openingCents, closingCents, returnCents,
    movements: movements.filter((movement) => movement.valueDate >= from && movement.valueDate <= to)
      .sort((left, right) => right.valueDate.localeCompare(left.valueDate)),
  };
}

/** A sum of entries, with their count: no entries (`null` in the statement) differ from entries summing to zero. */
type Total = { cents: number; count: number };

function addTo(totals: Map<IsoMonth, Total>, month: IsoMonth, cents: number): void {
  const monthTotal = totals.get(month) ?? { cents: 0, count: 0 };
  monthTotal.cents += cents;
  monthTotal.count += 1;
  totals.set(month, monthTotal);
}

/**
 * Statements for the given months, in the order given. One pass over the entries and movements: each entry is filed
 * under the month after which it is part of the 1st, and the 1st is carried forward from month to month.
 */
export function buildMonthStatements(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
  months: readonly IsoMonth[],
): MonthStatement[] {
  // Returns of earlier months are part of the 1st (as in the sheet); deposits and withdrawals count before the 1st.
  const countedAfter = new Map<IsoMonth, Total>();
  const returnsByMonth = new Map<IsoMonth, Total>();
  for (const entry of entries) {
    addTo(countedAfter, entry.returnMonth ?? monthOf(entry.valueDate), entry.amountCents);
    if (entry.returnMonth !== null) {
      addTo(returnsByMonth, entry.returnMonth, entry.amountCents);
    }
  }
  const movementsByMonth = new Map<IsoMonth, StatementMovement[]>();
  for (const movement of movements) {
    const month = monthOf(movement.valueDate);
    const monthMovements = movementsByMonth.get(month) ?? [];
    monthMovements.push(movement);
    movementsByMonth.set(month, monthMovements);
  }

  const openingByMonth = new Map<IsoMonth, Total>();
  const filedMonths = [...countedAfter.keys()].sort();
  const opening: Total = { cents: 0, count: 0 };
  let filed = 0;
  for (const month of [...new Set(months)].sort()) {
    for (; filed < filedMonths.length && filedMonths[filed] < month; filed++) {
      const { cents, count } = countedAfter.get(filedMonths[filed])!;
      opening.cents += cents;
      opening.count += count;
    }
    openingByMonth.set(month, { ...opening });
  }

  return months.map((month) => {
    const openingTotal = openingByMonth.get(month)!;
    const activity = countedAfter.get(month);
    const returns = returnsByMonth.get(month);
    return {
      month,
      openingCents: openingTotal.count > 0 ? openingTotal.cents : null,
      closingCents: openingTotal.count > 0 || activity !== undefined ? openingTotal.cents + (activity?.cents ?? 0) : null,
      returnCents: returns ? returns.cents : null,
      movements: (movementsByMonth.get(month) ?? []).toSorted((left, right) =>
        right.valueDate.localeCompare(left.valueDate),
      ),
    };
  });
}

export function buildMonthStatement(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
  month: IsoMonth,
): MonthStatement {
  return buildMonthStatements(entries, movements, [month])[0];
}

/** Statements for every month from `fromMonth` to `toMonth`, newest first. */
export function buildStatements(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
  fromMonth: IsoMonth,
  toMonth: IsoMonth,
): MonthStatement[] {
  const months: IsoMonth[] = [];
  for (let month = toMonth; month >= fromMonth; month = addMonths(month, -1)) {
    months.push(month);
  }
  return buildMonthStatements(entries, movements, months);
}

/** The first month with any booking or request, or `null` when there is none. */
export function firstStatementMonth(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
): IsoMonth | null {
  const dates = [...entries.map((entry) => entry.valueDate), ...movements.map((movement) => movement.valueDate)];
  if (dates.length === 0) {
    return null;
  }
  return dates.reduce((earliest, date) => (date < earliest ? date : earliest)).slice(0, 7);
}
