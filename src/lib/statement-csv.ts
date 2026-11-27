import type { Messages } from "@/i18n/messages/de";
import { addMonths, isIsoMonth, type IsoMonth } from "./calendar";
import { buildCsv, type CsvColumn } from "./csv";
import type { Formatter } from "./format";
import { statementVarianceCents, type MonthStatement, type StatementFigures, type StatementMovement } from "./statements";
import { statementPeriodLabel, type StatementPeriod } from "./statement-period";

/**
 * CSV exports of the monthly statement (see `src/lib/statements.ts`): all investors side by side like the client's
 * sheet (one row per investor, three columns per month), or one investor with one row per month. Months run oldest
 * first, as in every CSV export.
 */

/** The longest month range one export may span. */
export const MAX_EXPORT_MONTHS = 60;

export type MonthRange = { from: IsoMonth; to: IsoMonth };

/** Every month from `from` to `to`, oldest first. */
export function monthsBetween({ from, to }: MonthRange): IsoMonth[] {
  const months: IsoMonth[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

/**
 * The export's month range from the query ("YYYY-MM", both optional): `to` defaults to the current month, `from` to
 * `defaultFrom` (e.g. the first deposit) clamped to `MAX_EXPORT_MONTHS`. Swapped months are put in order. `null` for
 * a malformed month, a month in the future or an explicit range longer than `MAX_EXPORT_MONTHS`.
 */
export function parseExportMonthRange(
  query: { from?: string | null; to?: string | null },
  currentMonth: IsoMonth,
  defaultFrom: IsoMonth | null,
): MonthRange | null {
  const requestedTo = query.to || currentMonth;
  if (!isIsoMonth(requestedTo) || requestedTo > currentMonth) {
    return null;
  }
  if (query.from) {
    if (!isIsoMonth(query.from) || query.from > currentMonth) {
      return null;
    }
    const range =
      query.from <= requestedTo ? { from: query.from, to: requestedTo } : { from: requestedTo, to: query.from };
    return monthsBetween(range).length <= MAX_EXPORT_MONTHS ? range : null;
  }
  const earliest = addMonths(requestedTo, -(MAX_EXPORT_MONTHS - 1));
  const from =
    !defaultFrom || defaultFrom > requestedTo ? requestedTo : defaultFrom < earliest ? earliest : defaultFrom;
  return { from, to: requestedTo };
}

type CsvText = Messages["csv"];

function amount(format: Formatter, cents: number | null): string | null {
  return cents === null ? null : format.decimal(cents);
}

/**
 * The month's deposits and withdrawals as "26.09.2026: +1074,00 · 13.10.2026: -415,00 (offen)", oldest first. It
 * starts with the date, so spreadsheets don't read the sign as the start of a formula.
 */
function describeMovements(statement: StatementFigures, text: CsvText, format: Formatter): string | null {
  const descriptions = statement.movements
    .toSorted((left, right) => left.valueDate.localeCompare(right.valueDate))
    .map((movement) => {
      const sign = movement.amountCents > 0 ? "+" : "";
      const open = movement.pending ? ` (${text.pending})` : "";
      const fixedIncome = movement.status === "booked" ? ` (${text.fixedIncomeEntries[movement.kind]} · ${movement.reference})` : "";
      return `${format.calendarDate(movement.valueDate)}: ${sign}${format.decimal(movement.amountCents)}${open}${fixedIncome}`;
    });
  const difference = statementVarianceCents(statement);
  if (difference !== 0) descriptions.push(text.reviewDifference(format.signedCurrency(difference)));
  return descriptions.join(" · ") || null;
}

/** Sum of the booked movements of one kind, or `null` when there are none. */
function bookedTotal(movements: StatementMovement[], kind: StatementMovement["kind"]): number | null {
  const booked = movements.filter((movement) => movement.kind === kind && movement.booked);
  return booked.length > 0 ? booked.reduce((sum, movement) => sum + movement.amountCents, 0) : null;
}

export type InvestorStatementRow = {
  investorCode: string;
  fullName: string;
  statusLabel: string;
  /** One statement per exported month, oldest first. */
  statements: StatementFigures[];
};

/** All investors side by side: per month the investment on the 1st, the return and the miscellaneous movements. */
export function buildInvestorsStatementCsv(
  rows: InvestorStatementRow[],
  periods: (IsoMonth | StatementPeriod)[],
  text: CsvText,
  format: Formatter,
  delimiter: string,
): string {
  const columns: CsvColumn<InvestorStatementRow>[] = [
    { header: text.investorId, value: (row) => row.investorCode },
    { header: text.investor, value: (row) => row.fullName },
    { header: text.status, value: (row) => row.statusLabel },
    ...periods.flatMap((period, index): CsvColumn<InvestorStatementRow>[] => {
      const label = typeof period === "string" ? format.monthShort(period) : statementPeriodLabel(period, format);
      const opening = typeof period === "string" ? text.investmentOn(label) : text.openingOn(format.calendarDate(period.from));
      return [
        { header: opening, value: (row) => amount(format, row.statements[index].openingCents) },
        { header: text.returnFor(label), value: (row) => amount(format, row.statements[index].returnCents) },
        {
          header: text.miscFor(label),
          value: (row) => describeMovements(row.statements[index], text, format),
        },
      ];
    }),
    { header: text.closingBalance, value: (row) => amount(format, row.statements.at(-1)?.closingCents ?? null) },
  ];
  return buildCsv(columns, rows, delimiter);
}

/** One investor, one row per month, with the booked deposits and withdrawals also summed for calculations. */
export function buildInvestorStatementCsv(
  investor: { investorCode: string; fullName: string },
  statements: MonthStatement[],
  text: CsvText,
  format: Formatter,
  delimiter: string,
): string {
  const columns: CsvColumn<MonthStatement>[] = [
    { header: text.investorId, value: () => investor.investorCode },
    { header: text.investor, value: () => investor.fullName },
    { header: text.month, value: (statement) => format.month(statement.month) },
    { header: text.investment, value: (statement) => amount(format, statement.openingCents) },
    { header: text.monthReturn, value: (statement) => amount(format, statement.returnCents) },
    { header: text.deposits, value: (statement) => amount(format, bookedTotal(statement.movements, "deposit")) },
    { header: text.withdrawals, value: (statement) => amount(format, bookedTotal(statement.movements, "withdrawal")) },
    { header: text.misc, value: (statement) => describeMovements(statement, text, format) },
    { header: text.closingBalance, value: (statement) => amount(format, statement.closingCents) },
  ];
  return buildCsv(columns, statements, delimiter);
}
