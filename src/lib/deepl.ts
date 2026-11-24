import { MAX_NEWS_TEXT_LENGTH } from "@/lib/news";

/** DeepL answers within a second or two; a save shouldn't hang on an outage. */
const TIMEOUT_MS = 8000;

export type TranslationResult = { ok: true; text: string } | { ok: false; reason: string };

/** Free API keys end in ":fx" and are served from their own host. */
export function deeplTranslateUrl(apiKey: string): string {
  const host = apiKey.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  return `https://${host}/v2/translate`;
}

/**
 * Translates German text to British English (the app formats English as en-GB) with DeepL. Never throws: a network
 * error, timeout, non-2xx answer, or an empty or over-long translation (the column allows 500 characters) comes back
 * as `ok: false` with a reason that never contains the key.
 */
export async function translateGermanToEnglish(
  text: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TranslationResult> {
  let response: Response;
  try {
    response = await fetchImpl(deeplTranslateUrl(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `DeepL-Auth-Key ${apiKey}` },
      body: JSON.stringify({ text: [text], source_lang: "DE", target_lang: "EN-GB" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error" };
  }
  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status}` };
  }

  const body: unknown = await response.json().catch(() => null);
  const translations = (body as { translations?: unknown } | null)?.translations;
  const first: unknown = Array.isArray(translations) ? translations[0] : undefined;
  const translated = typeof first === "object" && first !== null && "text" in first ? first.text : undefined;
  if (typeof translated !== "string" || translated.trim() === "") {
    return { ok: false, reason: "empty translation" };
  }
  if (translated.trim().length > MAX_NEWS_TEXT_LENGTH) {
    return { ok: false, reason: "translation too long" };
  }
  return { ok: true, text: translated.trim() };
}
