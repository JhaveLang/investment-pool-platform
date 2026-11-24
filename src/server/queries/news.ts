import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { newsText, type PublicNewsItem } from "@/lib/news";
import { getDb } from "@/server/db/client";
import { newsEntries, type NewsEntry } from "@/server/db/schema";

// Newest date first; of two notices on the same date, the one added later.
const newestFirst = [desc(newsEntries.publishedOn), desc(newsEntries.createdAt)];

/** Visible notices for the public website in the visitor's language, newest first. */
export async function listPublicNews(locale: Locale, options: { limit?: number } = {}): Promise<PublicNewsItem[]> {
  const query = getDb()
    .select({
      id: newsEntries.id,
      publishedOn: newsEntries.publishedOn,
      textDe: newsEntries.textDe,
      textEn: newsEntries.textEn,
    })
    .from(newsEntries)
    .where(eq(newsEntries.visible, true))
    .orderBy(...newestFirst);
  const rows = options.limit === undefined ? await query : await query.limit(options.limit);
  return rows.map((row) => ({ id: row.id, date: row.publishedOn, text: newsText(row, locale) }));
}

/** Every notice for the admin list, hidden ones included, newest first. */
export async function listAllNews(): Promise<NewsEntry[]> {
  return getDb()
    .select()
    .from(newsEntries)
    .orderBy(...newestFirst);
}

export async function getNewsEntry(newsId: string): Promise<NewsEntry | null> {
  // Postgres throws on an invalid uuid cast, so reject anything else before querying.
  if (!z.uuid().safeParse(newsId).success) {
    return null;
  }
  const [entry] = await getDb().select().from(newsEntries).where(eq(newsEntries.id, newsId)).limit(1);
  return entry ?? null;
}
