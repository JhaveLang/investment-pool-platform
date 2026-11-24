import type { Locale } from "@/i18n/config";
import type { IsoDate } from "@/lib/calendar";

/** Longest notice the admin can write, per language. */
export const MAX_NEWS_TEXT_LENGTH = 500;

/** A notice as the public website shows it: one date and the text in the visitor's language. */
export type PublicNewsItem = { id: string; date: IsoDate; text: string };

/** The notice in the visitor's language; without an English text, the English website shows the German one. */
export function newsText(entry: { textDe: string; textEn: string | null }, locale: Locale): string {
  return locale === "en" ? (entry.textEn ?? entry.textDe) : entry.textDe;
}

/** Groups notices that are already sorted newest first by their year, keeping that order. */
export function groupNewsByYear<Item extends { date: IsoDate }>(items: readonly Item[]): [year: string, Item[]][] {
  const years = new Map<string, Item[]>();
  for (const item of items) {
    const year = item.date.slice(0, 4);
    const yearItems = years.get(year) ?? [];
    yearItems.push(item);
    years.set(year, yearItems);
  }
  return [...years];
}
