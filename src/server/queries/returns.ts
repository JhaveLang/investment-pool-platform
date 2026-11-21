import "server-only";
import { desc, eq, max, ne, sql } from "drizzle-orm";
import { addMonths, monthOf, todayIsoDate, type IsoMonth } from "@/lib/calendar";
import { getDb, type DbExecutor } from "@/server/db/client";
import { deposits, returnPeriods, users } from "@/server/db/schema";
import { depositValueDate } from "./accrual";

/** How many ended months are offered before the very first booking. */
const FIRST_BOOKING_CHOICES = 24;

export type ReturnSchedule = {
  /** The previous calendar month: the latest month whose result can be known. */
  lastEndedMonth: IsoMonth;
  lastBookedMonth: IsoMonth | null;
  /**
   * Months that can be booked now, newest first. Months are booked in order without gaps:
   * after the first booking only the month following the last booked one qualifies, once
   * it has ended. The first booking may pick any ended month since the first deposit was
   * received, so results settled before the platform went live don't have to be re-entered.
   */
  bookableMonths: IsoMonth[];
};

export async function getReturnSchedule(executor: DbExecutor = getDb()): Promise<ReturnSchedule> {
  const lastEndedMonth = addMonths(monthOf(todayIsoDate()), -1);
  const [{ lastBookedStart }] = await executor
    .select({ lastBookedStart: max(returnPeriods.periodStart) })
    .from(returnPeriods);

  if (lastBookedStart) {
    const lastBookedMonth = monthOf(lastBookedStart);
    const nextMonth = addMonths(lastBookedMonth, 1);
    return { lastEndedMonth, lastBookedMonth, bookableMonths: nextMonth <= lastEndedMonth ? [nextMonth] : [] };
  }

  const [{ firstDepositMonth }] = await executor
    .select({ firstDepositMonth: sql<string | null>`to_char(min(${depositValueDate}), 'YYYY-MM')` })
    .from(deposits)
    .where(ne(deposits.status, "rejected"));
  const bookableMonths: IsoMonth[] = [];
  if (firstDepositMonth) {
    for (let month = lastEndedMonth; month >= firstDepositMonth && bookableMonths.length < FIRST_BOOKING_CHOICES;) {
      bookableMonths.push(month);
      month = addMonths(month, -1);
    }
  }
  return { lastEndedMonth, lastBookedMonth: null, bookableMonths };
}

export type ReturnPeriodRow = {
  id: string;
  month: IsoMonth;
  ratePpm: number;
  totalCents: number;
  accountCount: number;
  createdAt: Date;
  bookedByName: string;
};

export async function listReturnPeriods(): Promise<ReturnPeriodRow[]> {
  return getDb()
    .select({
      id: returnPeriods.id,
      month: sql<string>`to_char(${returnPeriods.periodStart}, 'YYYY-MM')`,
      ratePpm: returnPeriods.ratePpm,
      totalCents: returnPeriods.totalCents,
      accountCount: returnPeriods.accountCount,
      createdAt: returnPeriods.createdAt,
      bookedByName: users.fullName,
    })
    .from(returnPeriods)
    .innerJoin(users, eq(returnPeriods.createdByUserId, users.id))
    .orderBy(desc(returnPeriods.periodStart));
}
