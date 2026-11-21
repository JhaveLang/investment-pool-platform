import { setLocaleAction } from "@/actions/locale";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";

/** DE | EN toggle. A plain form posting to a Server Action, so it works without client JavaScript. */
export async function LocaleSwitcher() {
  const { locale: activeLocale, messages } = await getI18n();

  return (
    <form
      action={setLocaleAction}
      role="group"
      aria-label={messages.nav.language}
      className="flex rounded-full bg-surface p-1 ring-1 ring-line ring-inset"
    >
      {LOCALES.map((locale) => {
        const isActive = locale === activeLocale;
        return (
          <button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            lang={locale}
            title={LOCALE_LABELS[locale].name}
            aria-pressed={isActive}
            className={cn(
              "label-caps rounded-full px-2.5 py-1 transition-colors",
              isActive ? "bg-overlay text-fg" : "text-subtle hover:text-fg",
            )}
          >
            {LOCALE_LABELS[locale].short}
          </button>
        );
      })}
    </form>
  );
}
