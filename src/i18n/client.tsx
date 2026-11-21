"use client";

import { createContext, use, type ReactNode } from "react";
import { getFormatter, type Formatter } from "@/lib/format";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { dictionaries, type Messages } from "./dictionaries";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Only the locale crosses the server/client boundary; client components read the
 * dictionary locally because messages contain functions, which can't be serialised.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useMessages(): Messages {
  return dictionaries[use(LocaleContext)];
}

export function useLocale(): Locale {
  return use(LocaleContext);
}

/** Number and date formatting in the active language, e.g. for live previews in forms. */
export function useFormatter(): Formatter {
  return getFormatter(use(LocaleContext));
}
