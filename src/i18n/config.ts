export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** German is the default: the platform must be fully usable in German without any choice. */
export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_COOKIE_NAME = "locale";

/** Locale used for Intl number/date formatting. en-GB keeps the 24-hour clock and day-month order. */
export const INTL_LOCALES: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
};

/** Shown in the language switcher, each language in its own name. */
export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  de: { short: "DE", name: "Deutsch" },
  en: { short: "EN", name: "English" },
};

/** Spreadsheet conventions: German Excel expects ";" because "," is the decimal separator. */
export const CSV_DELIMITERS: Record<Locale, string> = {
  de: ";",
  en: ",",
};

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}
