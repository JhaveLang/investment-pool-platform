import "server-only";
import { translateGermanToEnglish } from "@/lib/deepl";
import { getDeeplApiKey } from "@/server/env";

/** German text in, English text out; null when no translation is available. */
export type Translator = (germanText: string) => Promise<string | null>;

/** Translates with DeepL; null without `DEEPL_API_KEY` or when DeepL fails (logged with the reason, never the key). */
export const translateToEnglish: Translator = async (germanText) => {
  const apiKey = getDeeplApiKey();
  if (!apiKey) {
    return null;
  }
  const result = await translateGermanToEnglish(germanText, apiKey);
  if (!result.ok) {
    console.error(`[deepl] Translation failed: ${result.reason}`);
    return null;
  }
  return result.text;
};
