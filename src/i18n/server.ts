import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cache } from "react";
import { getFormatter, type Formatter } from "@/lib/format";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";
import { dictionaries, type Messages } from "./dictionaries";

export type I18n = {
  locale: Locale;
  messages: Messages;
  format: Formatter;
};

/** The visitor's chosen language (cookie), falling back to German. */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
});

/** Dictionary and formatters for the current request (memoised per request). */
export const getI18n = cache(async (): Promise<I18n> => {
  const locale = await getLocale();
  return { locale, messages: dictionaries[locale], format: getFormatter(locale) };
});

/** Shorthand for pages: `export const generateMetadata = pageMetadata((messages) => messages.dashboard.title);` */
export function pageMetadata(selectTitle: (messages: Messages) => string) {
  return async (): Promise<Metadata> => {
    const { messages } = await getI18n();
    return { title: selectTitle(messages) };
  };
}
