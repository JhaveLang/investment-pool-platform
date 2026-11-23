import Link from "next/link";
import { getAccountLink } from "@/components/public/site-header";
import { publicContainer } from "@/components/public/site-layout";
import { buttonStyles } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { SITE } from "@/config/site";
import { sortedNews } from "@/content/news";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";

const LATEST_NEWS = 3;

/**
 * The website's start page: who the pool is, the way into the online account for existing investors, the latest
 * notices and the contact. It makes no offer and states no returns.
 */
export default async function HomePage() {
  const { messages, format, locale } = await getI18n();
  const text = messages.site;
  const account = await getAccountLink();
  const latest = sortedNews().slice(0, LATEST_NEWS);
  const auth = messages.auth;
  const facts: Array<{ icon: IconName; title: string; detail: string }> = [
    { icon: "lock", title: auth.factTermTitle(MINIMUM_TERM_DAYS), detail: auth.factTermDetail },
    { icon: "trendingUp", title: auth.factAccrualTitle(ACCRUAL_DELAY_DAYS), detail: auth.factAccrualDetail },
    { icon: "arrowUpRight", title: auth.factPayoutTitle(PAYOUT_DEADLINE_DAYS), detail: auth.factPayoutDetail },
    { icon: "shieldCheck", title: auth.factLedgerTitle, detail: auth.factLedgerDetail },
  ];

  return (
    <>
      <section
        className={cn(
          publicContainer,
          "grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16",
        )}
      >
        <div>
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-400/25 bg-accent-400/10 px-2.5 py-1 text-accent-400">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-400" />
            <span className="label-caps">{text.since(format.month(SITE.foundedMonth))}</span>
          </span>
          <h1 className="mt-5 font-display text-[40px] leading-[1.08] font-bold tracking-[-0.03em] text-fg sm:text-[56px]">
            {messages.app.name}
          </h1>
          <p className="mt-3 font-display text-xl font-semibold text-muted sm:text-2xl">{text.tagline}</p>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{text.heroText}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={account.href} className={buttonStyles({ size: "lg" })}>
              <Icon name="lock" className="size-4" />
              {account.label}
            </Link>
            <Link href="/news" className={buttonStyles({ variant: "secondary", size: "lg" })}>
              {text.allNews}
            </Link>
          </div>
        </div>

        <aside className="ambient-glow flex flex-col gap-5 rounded-2xl bg-raised p-6 shadow-xl sm:p-8">
          <span className="label-caps text-accent-400">{text.forInvestors}</span>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-fg">{text.accountTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{text.accountText}</p>
          </div>
          <ul className="space-y-2.5">
            {text.accountFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-fg">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-400/15 text-accent-400">
                  <Icon name="shieldCheck" className="size-3" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <Link href={account.href} className={buttonStyles({ className: "w-full" })}>
            {account.label}
          </Link>
          {SITE.closedToNewInvestorsSince ? (
            <p className="rounded-xl bg-overlay/60 px-4 py-3 text-[13px] text-muted">
              {text.closedSince(format.calendarDate(SITE.closedToNewInvestorsSince))}
            </p>
          ) : null}
        </aside>
      </section>

      <section className={cn(publicContainer, "py-8")}>
        <h2 className="font-display text-2xl font-bold tracking-tight text-fg">{text.howItWorks}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <li key={fact.title} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
              <span className="grid size-10 place-items-center rounded-lg bg-accent-400/10 text-accent-400">
                <Icon name={fact.icon} className="size-5" />
              </span>
              <span className="mt-1 font-display text-base font-semibold text-fg">{fact.title}</span>
              <span className="text-sm text-muted">{fact.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cn(publicContainer, "grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_380px]")}>
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-fg">{text.latestNews}</h2>
            <Link href="/news" className="text-sm font-semibold text-accent-400 hover:underline">
              {text.allNews} →
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="mt-4 text-sm text-subtle">{text.newsEmpty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {latest.map((entry) => (
                <li key={`${entry.date}-${entry.text.de}`} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                  <time dateTime={entry.date} className="shrink-0 text-sm text-subtle sm:w-28">
                    {format.calendarDate(entry.date)}
                  </time>
                  <p className="text-sm text-fg">{entry.text[locale]}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold tracking-tight text-fg">{text.contactTitle}</h2>
          <p className="text-sm leading-relaxed text-muted">{text.contactText}</p>
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="flex items-center gap-2 text-sm font-semibold break-all text-accent-400 hover:underline"
          >
            <Icon name="send" className="size-4 shrink-0" />
            {SITE.contactEmail}
          </a>
          <Link href="/contact" className={buttonStyles({ variant: "secondary", className: "mt-auto w-fit" })}>
            {text.contact}
          </Link>
        </div>
      </section>
    </>
  );
}
