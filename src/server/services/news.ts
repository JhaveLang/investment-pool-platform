import "server-only";
import { eq } from "drizzle-orm";
import type { IsoDate } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { newsEntries } from "@/server/db/schema";
import { translateToEnglish, type Translator } from "@/server/translate";
import { recordAudit } from "./audit";

/** What the admin enters; the English text is translated from the German one. */
type NewsInput = { publishedOn: IsoDate; textDe: string; visible: boolean };
type NewsFields = NewsInput & { textEn: string | null };
export type NewsField = keyof NewsFields;
type Actor = { adminId: string; ipAddress: string | null };

/** `englishMissing`: the notice has no English text, so the English website shows the German one. */
export type NewsSaveResult = { englishMissing: boolean };

/**
 * Adds a notice with its English translation (null if DeepL is unavailable); the activity log keeps its date and
 * German text. DeepL is called before the transaction, so no database work waits on it. `translate` is a test hook.
 */
export async function createNewsEntry(
  input: NewsInput & Actor,
  translate: Translator = translateToEnglish,
): Promise<NewsSaveResult & { id: string }> {
  const textEn = await translate(input.textDe);
  const id = await getDb().transaction(async (tx) => {
    const [entry] = await tx
      .insert(newsEntries)
      .values({ publishedOn: input.publishedOn, textDe: input.textDe, textEn, visible: input.visible })
      .returning({ id: newsEntries.id });
    await recordAudit(tx, {
      actorUserId: input.adminId,
      action: "news.created",
      entityType: "news",
      entityId: entry.id,
      metadata: { publishedOn: input.publishedOn, text: input.textDe, visible: input.visible },
      ipAddress: input.ipAddress,
    });
    return entry.id;
  });
  return { id, englishMissing: textEn === null };
}

/**
 * Changes the given fields of a notice (the edit form passes all of them, the list's hide/show button only
 * `visible`). A changed German text is translated again; if that fails, the old English text is dropped rather than
 * left outdated. An unchanged German text keeps its English text (no DeepL call), unless there is none yet, so saving
 * again retries a failed translation. Returns `"unchanged"` (and writes nothing) when nothing differs; the log names
 * the changed fields.
 */
export async function updateNewsEntry(
  input: { newsId: string } & Partial<NewsInput> & Actor,
  translate: Translator = translateToEnglish,
): Promise<NewsSaveResult & { outcome: "updated" | "unchanged" }> {
  // Translate first, outside the transaction, so the row lock isn't held during the HTTP call.
  const [current] = await getDb()
    .select({ textDe: newsEntries.textDe, textEn: newsEntries.textEn })
    .from(newsEntries)
    .where(eq(newsEntries.id, input.newsId))
    .limit(1);
  if (!current) {
    throw new DomainError("NOT_FOUND");
  }
  let textEn: string | null | undefined;
  if (input.textDe !== undefined && (input.textDe !== current.textDe || current.textEn === null)) {
    textEn = await translate(input.textDe);
  }

  return getDb().transaction(async (tx) => {
    const [entry] = await tx.select().from(newsEntries).where(eq(newsEntries.id, input.newsId)).for("update").limit(1);
    if (!entry) {
      throw new DomainError("NOT_FOUND");
    }

    const values: Partial<NewsFields> = {};
    if (input.publishedOn !== undefined && input.publishedOn !== entry.publishedOn) {
      values.publishedOn = input.publishedOn;
    }
    if (input.textDe !== undefined && input.textDe !== entry.textDe) {
      values.textDe = input.textDe;
    }
    if (textEn !== undefined && textEn !== entry.textEn) {
      values.textEn = textEn;
    }
    if (input.visible !== undefined && input.visible !== entry.visible) {
      values.visible = input.visible;
    }
    const englishMissing = (values.textEn !== undefined ? values.textEn : entry.textEn) === null;
    const changed = Object.keys(values) as NewsField[];
    if (changed.length === 0) {
      return { outcome: "unchanged" as const, englishMissing };
    }

    await tx
      .update(newsEntries)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(newsEntries.id, input.newsId));
    await recordAudit(tx, {
      actorUserId: input.adminId,
      action: "news.updated",
      entityType: "news",
      entityId: input.newsId,
      metadata: {
        publishedOn: values.publishedOn ?? entry.publishedOn,
        text: values.textDe ?? entry.textDe,
        visible: values.visible ?? entry.visible,
        changed,
      },
      ipAddress: input.ipAddress,
    });
    return { outcome: "updated" as const, englishMissing };
  });
}

/** Deletes a notice for good; the activity log keeps its date and both texts. */
export async function deleteNewsEntry(input: { newsId: string } & Actor): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [entry] = await tx
      .delete(newsEntries)
      .where(eq(newsEntries.id, input.newsId))
      .returning({ publishedOn: newsEntries.publishedOn, textDe: newsEntries.textDe, textEn: newsEntries.textEn });
    if (!entry) {
      throw new DomainError("NOT_FOUND");
    }
    await recordAudit(tx, {
      actorUserId: input.adminId,
      action: "news.deleted",
      entityType: "news",
      entityId: input.newsId,
      metadata: { publishedOn: entry.publishedOn, text: entry.textDe, textEn: entry.textEn },
      ipAddress: input.ipAddress,
    });
  });
}
