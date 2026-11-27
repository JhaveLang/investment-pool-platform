import { formatIsoDate } from "./format";

/** A calendar day in the app's time zone as an ISO string, e.g. "2026-11-08". */
export type IsoDate = string;
/** A calendar month as an ISO string, e.g. "2026-10". */
export type IsoMonth = string;

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Day arithmetic runs on UTC midnights, so daylight saving time can never shift a date.
function toUtcMilliseconds(date: IsoDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMilliseconds(milliseconds: number): IsoDate {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

export function isIsoMonth(value: string): value is IsoMonth {
  return ISO_MONTH_PATTERN.test(value);
}

/** Today's date in Berlin time. */
export function todayIsoDate(now: Date = new Date()): IsoDate {
  return formatIsoDate(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMilliseconds(toUtcMilliseconds(date) + days * MILLISECONDS_PER_DAY);
}

/** Whole days from `from` to `to`: 0 for the same day, negative if `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMilliseconds(to) - toUtcMilliseconds(from)) / MILLISECONDS_PER_DAY);
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function addMonths(month: IsoMonth, months: number): IsoMonth {
  const [year, monthNumber] = month.split("-").map(Number);
  return fromUtcMilliseconds(Date.UTC(year, monthNumber - 1 + months, 1)).slice(0, 7);
}

/** Add calendar months to a date, clamping to the final day when the target month is shorter. */
export function addCalendarMonths(date: IsoDate, months: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function firstDayOfMonth(month: IsoMonth): IsoDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: IsoMonth): IsoDate {
  return addDays(firstDayOfMonth(addMonths(month, 1)), -1);
}

export function daysInMonth(month: IsoMonth): number {
  return daysBetween(firstDayOfMonth(month), lastDayOfMonth(month)) + 1;
}
