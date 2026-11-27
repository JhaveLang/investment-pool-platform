import { z } from "zod";
import { addMonths, firstDayOfMonth, lastDayOfMonth, monthOf, type IsoDate } from "./calendar";
import type { Formatter } from "./format";

export type StatementPeriod = { value: string; from: IsoDate; to: IsoDate };

/** A closed Berlin calendar range; the current month or year runs through today. */
export function parseStatementPeriod(value: string, today: IsoDate): StatementPeriod | null {
  const parts = /^([1-9]\d{3})(?:-(0[1-9]|1[0-2])(?:-(\d{2}))?)?$/.exec(value);
  if (!parts) return null;
  const [, year, month, day] = parts;
  const from = `${year}-${month ?? "01"}-${day ?? "01"}`;
  if (from > today || !z.iso.date().safeParse(from).success) return null;
  const end = day ? from : lastDayOfMonth(`${year}-${month ?? "12"}`);
  return { value, from, to: end > today ? today : end };
}

export function directoryStatementMonths(today: IsoDate, requestedMonth?: string) {
  const january = `${today.slice(0, 4)}-01`;
  const months = Array.from({ length: 12 }, (_item, index) => addMonths(january, index));
  const currentMonth = monthOf(today);
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : currentMonth;
  const period: StatementPeriod = {
    value: month,
    from: firstDayOfMonth(month),
    to: month === currentMonth ? today : lastDayOfMonth(month),
  };
  return { months, currentMonth, period };
}

export function statementPeriodLabel({ value }: StatementPeriod, format: Formatter): string {
  if (value.length === 4) return value;
  return value.length === 7 ? format.monthShort(value) : format.calendarDate(value);
}
