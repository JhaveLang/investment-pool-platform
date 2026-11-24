"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { errorState, readFormText, successState, validationErrorState, type ActionState } from "@/lib/action-state";
import { getSchemas } from "@/lib/validation";
import { toErrorState } from "@/server/action-errors";
import { requireAdmin } from "@/server/auth/guards";
import { getClientIp } from "@/server/request";
import { createNewsEntry, deleteNewsEntry, updateNewsEntry } from "@/server/services/news";

/** The notice form's fields as submitted, so a failed save can show them again. */
function readNewsForm(formData: FormData) {
  return {
    publishedOn: readFormText(formData, "publishedOn"),
    textDe: readFormText(formData, "textDe"),
    visible: formData.get("visible") === "on" ? "on" : "",
  };
}

/** Admin adds a notice (DeepL adds the English text); the news list then confirms it, or warns if untranslated. */
export async function createNewsAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const values = readNewsForm(formData);
  const parsed = getSchemas(locale).newsEntrySchema.safeParse({ ...values, visible: values.visible === "on" });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  let englishMissing: boolean;
  try {
    ({ englishMissing } = await createNewsEntry({ ...parsed.data, adminId: admin.id, ipAddress: await getClientIp() }));
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  // The home page and the News page show notices too.
  revalidatePath("/", "layout");
  redirect(`/admin/news?created=${englishMissing ? "untranslated" : "1"}`);
}

// The notice id is bound on the server (`action.bind(null, id)`), the rest comes from the form.

/** Admin edits a notice's date, German text and visibility; a changed text is translated again. */
export async function updateNewsAction(
  newsId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const schemas = getSchemas(locale);
  const values = readNewsForm(formData);
  if (!schemas.newsIdSchema.safeParse(newsId).success) {
    return errorState(messages.validation.invalidRequest);
  }
  const parsed = schemas.newsEntrySchema.safeParse({ ...values, visible: values.visible === "on" });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  let englishMissing: boolean;
  try {
    const result = await updateNewsEntry({ newsId, ...parsed.data, adminId: admin.id, ipAddress: await getClientIp() });
    // Nothing changed; with no English text that means saving again didn't get a translation either.
    if (result.outcome === "unchanged") {
      return result.englishMissing
        ? errorState(messages.admin.news.translationFailed)
        : successState(messages.admin.news.unchanged);
    }
    englishMissing = result.englishMissing;
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  revalidatePath("/", "layout");
  redirect(`/admin/news?saved=${englishMissing ? "untranslated" : "1"}`);
}

/** Hides a notice from the website or shows it again, straight from the news list. */
export async function setNewsVisibilityAction(newsId: string, visible: boolean): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  if (!getSchemas(locale).newsIdSchema.safeParse(newsId).success) {
    return errorState(messages.validation.invalidRequest);
  }

  try {
    await updateNewsEntry({ newsId, visible, adminId: admin.id, ipAddress: await getClientIp() });
  } catch (error) {
    return toErrorState(error, messages);
  }
  revalidatePath("/", "layout");
  return successState(visible ? messages.admin.news.shownDone : messages.admin.news.hiddenDone);
}

/** Deletes a notice for good (the list asks for confirmation first). */
export async function deleteNewsAction(newsId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  if (!getSchemas(locale).newsIdSchema.safeParse(newsId).success) {
    return errorState(messages.validation.invalidRequest);
  }

  try {
    await deleteNewsEntry({ newsId, adminId: admin.id, ipAddress: await getClientIp() });
  } catch (error) {
    return toErrorState(error, messages);
  }
  revalidatePath("/", "layout");
  return successState(messages.admin.news.deleted);
}
