import { addDays, daysBetween, type IsoDate } from "./calendar";

/**
 * Returns start 7 days after the payment is received; no return accrues on the day itself.
 * A deposit received on the 1st therefore earns from the 8th.
 */
export const ACCRUAL_DELAY_DAYS = 7;

/** Deposited capital stays in the pool for at least 60 days; returns can be withdrawn at any time. */
export const MINIMUM_TERM_DAYS = 60;

/** Withdrawals are always paid out within 7 days of the request. */
export const PAYOUT_DEADLINE_DAYS = 7;

/** Rates are stored as integer parts per million of the capital: 2,35 % = 23 500 ppm. */
const PPM_PER_UNIT = BigInt(1_000_000);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

/** Monthly results must stay above −100 % (total loss) and at most +100 %. */
export const MIN_RATE_PPM_EXCLUSIVE = -1_000_000;
export const MAX_RATE_PPM = 1_000_000;

export function accrualStartForDeposit(receivedOn: IsoDate): IsoDate {
  return addDays(receivedOn, ACCRUAL_DELAY_DAYS);
}

/** First day on which the deposited capital may be withdrawn. */
export function minimumTermEnd(receivedOn: IsoDate): IsoDate {
  return addDays(receivedOn, MINIMUM_TERM_DAYS);
}

export function payoutDeadline(requestedOn: IsoDate): IsoDate {
  return addDays(requestedOn, PAYOUT_DEADLINE_DAYS);
}

/**
 * A change of the capital that earns returns, effective from (and including) `effectiveOn`.
 * Deposits take effect on their accrual start; withdrawals on the request day, so a request
 * on the 20th leaves 19 earning days in that month.
 */
export type CapitalChange = {
  effectiveOn: IsoDate;
  amountCents: number;
};

/**
 * Days on which an investor's capital neither earns nor loses: from the day they were deactivated up to, but not
 * including, the day they were activated again (`until` null: still deactivated). Deactivated on the 10th and
 * activated on the 20th leaves the 10th to the 19th out.
 */
export type PausedRange = {
  from: IsoDate;
  until: IsoDate | null;
};

/** How many days of `from`…`to` (inclusive) fall into the paused ranges; the ranges must not overlap. */
export function pausedDaysBetween(from: IsoDate, to: IsoDate, paused: readonly PausedRange[]): number {
  let days = 0;
  for (const range of paused) {
    const start = range.from > from ? range.from : from;
    const lastPausedDay = range.until === null ? to : addDays(range.until, -1);
    const end = lastPausedDay < to ? lastPausedDay : to;
    if (start <= end) {
      days += daysBetween(start, end) + 1;
    }
  }
  return days;
}

/**
 * The earning capital summed over every day of the period ("cent-days"). Each change counts
 * from its effective day to the period end; changes from before the period count every day.
 * Paused days (the investor was deactivated) don't count, so they bring neither return nor loss.
 */
export function sumCapitalDays(
  changes: readonly CapitalChange[],
  periodStart: IsoDate,
  periodEnd: IsoDate,
  paused: readonly PausedRange[] = [],
): bigint {
  let capitalDays = ZERO;
  for (const change of changes) {
    if (change.effectiveOn > periodEnd) {
      continue;
    }
    const countedFrom = change.effectiveOn < periodStart ? periodStart : change.effectiveOn;
    const earningDays = daysBetween(countedFrom, periodEnd) + 1 - pausedDaysBetween(countedFrom, periodEnd, paused);
    capitalDays += BigInt(change.amountCents) * BigInt(earningDays);
  }
  return capitalDays;
}

/** Divides and rounds half away from zero, in BigInt so large balances never lose precision. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < ZERO ? -ONE : ONE;
  const magnitude = numerator * sign;
  return sign * ((magnitude * TWO + denominator) / (denominator * TWO));
}

export type PeriodReturn = {
  /** Day-weighted average capital over the period. */
  averageCapitalCents: number;
  /** Return for the period, rounded half away from zero to the cent; negative for a loss. */
  returnCents: number;
};

/**
 * Exact-to-the-day return: the monthly rate applied to the day-weighted average capital,
 * i.e. every earning day contributes rate ÷ days-in-month of that day's capital.
 */
export function calculatePeriodReturn(capitalDays: bigint, ratePpm: number, daysInPeriod: number): PeriodReturn {
  if (capitalDays <= ZERO) {
    return { averageCapitalCents: 0, returnCents: 0 };
  }
  const days = BigInt(daysInPeriod);
  return {
    averageCapitalCents: Number(divideRounded(capitalDays, days)),
    returnCents: Number(divideRounded(capitalDays * BigInt(ratePpm), days * PPM_PER_UNIT)),
  };
}
