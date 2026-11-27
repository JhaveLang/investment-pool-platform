import { setLocaleAction } from "@/actions/locale";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { keepsPage } from "@/lib/keeps-page";

/** DE | EN toggle. A plain form posting to a Server Action, so it works without client JavaScript. */
export async function LocaleSwitcher() {
  const { locale: activeLocale, messages } = await getI18n();

  return (
    <form
      action={setLocaleAction}
      // Re-renders the current page in the new language; unsaved changes on it survive.
      {...keepsPage}
      role="group"
      aria-label={messages.nav.language}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-xs border border-line-strong bg-surface p-0.5"
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
            className={buttonStyles({
              size: "sm",
              variant: isActive ? "selected" : "ghost",
              className: "min-h-6 px-2 text-xs",
            })}
          >
            {LOCALE_LABELS[locale].short}
          </button>
        );
      })}
    </form>
  );
}
