import "server-only";
import { and, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { APP_TIME_ZONE } from "@/lib/format";

/** Calendar dates in ISO format (YYYY-MM-DD), interpreted in the app's time zone. */
export type DateRange = {
  from?: string;
  to?: string;
};

/** Builds an inclusive day range filter, e.g. 01.11.–30.11. covers both full days in Berlin time. */
export function createdWithinRange(column: AnyPgColumn, range: DateRange): SQL | undefined {
  const conditions: SQL[] = [];
  if (range.from) {
    conditions.push(sql`${column} >= (${range.from}::date::timestamp at time zone ${APP_TIME_ZONE})`);
  }
  if (range.to) {
    conditions.push(sql`${column} < ((${range.to}::date + 1)::timestamp at time zone ${APP_TIME_ZONE})`);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function toContainsPattern(searchTerm: string): string {
  return `%${searchTerm.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
