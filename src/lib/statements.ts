import type { DepositStatus, WithdrawalStatus } from "@/server/db/schema";
import { addMonths, firstDayOfMonth, lastDayOfMonth, type IsoDate, type IsoMonth } from "./calendar";

/**
 * Monthly statement per investor, in the pool's month-end convention: the investment on the 1st, the month's return
 * and the month's deposits and withdrawals ("Sonstiges"). Amounts count on their value date: a deposit on its
 * receipt date, a withdrawal on its request date, and a month's return from the 1st of the following month. So the
 * 1st of next month = 1st of this month + this month's return + this month's booked deposits and withdrawals.
 */

/** Booked ledger amounts summed per value date (and per return month for returns). */
export type StatementEntry = {
  valueDate: IsoDate;
  amountCents: number;
  /** For monthly returns: the month the return was earned in. */
  returnMonth: IsoMonth | null;
};

/** A deposit or withdrawal listed under "Sonstiges", with its net effect on the balance. */
export type StatementMovement = (
  { kind: "deposit"; status: DepositStatus } | { kind: "withdrawal"; status: WithdrawalStatus }
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

export type MonthStatement = {
  month: IsoMonth;
  /** Balance on the 1st; `null` when nothing was booked before the month. */
  openingCents: number | null;
  /** The month's return once booked, else `null`. */
  returnCents: number | null;
  /** The month's deposits and withdrawals, newest first (cancelled and rejected ones are left out). */
  movements: StatementMovement[];
};

function total(entries: readonly StatementEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amountCents, 0);
}

export function buildMonthStatement(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
  month: IsoMonth,
): MonthStatement {
  const start = firstDayOfMonth(month);
  const end = lastDayOfMonth(month);
  // Returns of earlier months are part of the 1st (as in the sheet); deposits and withdrawals count before the 1st.
  const before = entries.filter((entry) =>
    entry.returnMonth === null ? entry.valueDate < start : entry.returnMonth < month,
  );
  const returns = entries.filter((entry) => entry.returnMonth === month);
  return {
    month,
    openingCents: before.length > 0 ? total(before) : null,
    returnCents: returns.length > 0 ? total(returns) : null,
    movements: movements
      .filter((movement) => movement.valueDate >= start && movement.valueDate <= end)
      .sort((left, right) => right.valueDate.localeCompare(left.valueDate)),
  };
}

/** Statements for every month from `fromMonth` to `toMonth`, newest first. */
export function buildStatements(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
  fromMonth: IsoMonth,
  toMonth: IsoMonth,
): MonthStatement[] {
  const statements: MonthStatement[] = [];
  for (let month = toMonth; month >= fromMonth; month = addMonths(month, -1)) {
    statements.push(buildMonthStatement(entries, movements, month));
  }
  return statements;
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
