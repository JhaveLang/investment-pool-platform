import Image from "next/image";
import Link from "next/link";
import teamCall from "@/assets/team-call.png";
import { HeroBackdrop } from "@/components/public/hero-backdrop";
import { RulesTimeline } from "@/components/public/rules-timeline";
import { getAccountLink } from "@/components/public/site-header";
import { publicContainer } from "@/components/public/site-layout";
import { buttonStyles } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { SITE } from "@/config/site";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";
import { listPublicNews } from "@/server/queries/news";

const LATEST_NEWS = 3;

/**
 * The website's start page: who the pool is, the way into the online account for existing investors, the latest
 * notices and the contact. It makes no offer and states no returns.
 */
export default async function HomePage() {
  const { messages, format, locale } = await getI18n();
  const text = messages.site;
  const [account, latest] = await Promise.all([getAccountLink(), listPublicNews(locale, { limit: LATEST_NEWS })]);
  const auth = messages.auth;
  const facts: Array<{ icon: IconName; title: string; detail: string }> = [
    { icon: "lock", title: auth.factTermTitle(MINIMUM_TERM_DAYS), detail: auth.factTermDetail },
    { icon: "trendingUp", title: auth.factAccrualTitle(ACCRUAL_DELAY_DAYS), detail: auth.factAccrualDetail },
    { icon: "arrowUpRight", title: auth.factPayoutTitle(PAYOUT_DEADLINE_DAYS), detail: auth.factPayoutDetail },
    { icon: "shieldCheck", title: auth.factLedgerTitle, detail: auth.factLedgerDetail },
  ];

  const keyFacts = [
    { label: text.termLabel, value: text.termValue(MINIMUM_TERM_DAYS) },
    { label: text.accrualLabel, value: text.accrualValue(ACCRUAL_DELAY_DAYS) },
    { label: text.payoutLabel, value: text.payoutValue(PAYOUT_DEADLINE_DAYS) },
  ];

  return (
    <>
      <section className="grid-backdrop relative overflow-hidden border-b border-line">
        <HeroBackdrop />
        <div
          className={cn(publicContainer, "relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16")}
        >
          <div>
            <span className="flex w-fit items-center gap-1.5 rounded-full border border-line-strong/60 bg-overlay px-3 py-1 text-accent-300">
              <span aria-hidden className="size-1.5 rounded-full bg-accent-300" />
              <span className="label-caps">{text.since(format.month(SITE.foundedMonth))}</span>
            </span>
            <h1 className="mt-5 font-display text-[32px] leading-[38px] font-bold tracking-[-0.02em] text-balance text-accent-300 md:text-[52px] md:leading-[58px]">
              {messages.app.name}
            </h1>
            <p className="mt-3 font-display text-[22px] leading-7 font-bold text-muted">{text.tagline}</p>
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
            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-line pt-5">
              {keyFacts.map((fact) => (
                <div key={fact.label}>
                  <dt className="label-caps break-words hyphens-auto text-muted">{fact.label}</dt>
                  <dd className="mt-1 font-semibold text-accent-300">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xl">
            <Image
              src={teamCall}
              alt={text.heroImageAlt}
              sizes="(min-width: 1024px) 512px, 100vw"
              placeholder="blur"
              loading="eager"
              fetchPriority="high"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className={cn(publicContainer, "grid gap-6 py-12 lg:grid-cols-2 lg:py-16")}>
        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="label-caps block text-muted">{text.ledgerLabel}</span>
              <h2 className="mt-1 font-display text-[22px] leading-7 font-bold text-accent-300">{text.ledgerTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text.ledgerText}</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-overlay text-accent-400">
              <Icon name="receipt" className="size-5" />
            </span>
          </div>
          <RulesTimeline />
        </div>

        <aside className="flex flex-col justify-between gap-6 rounded-3xl border border-line bg-surface p-6 shadow-lg sm:p-8">
          <div className="flex flex-col gap-5">
            <div>
              <span className="label-caps block text-muted">{text.forInvestors}</span>
              <h2 className="mt-1 font-display text-[28px] leading-[34px] font-bold text-accent-300">
                {text.accountTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text.accountText}</p>
            </div>
            <ul className="space-y-2.5">
              {text.accountFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-fg">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-overlay text-accent-400">
                    <Icon name="shieldCheck" className="size-3" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <Link href={account.href} className={buttonStyles({ size: "lg", className: "w-full" })}>
              {account.label}
            </Link>
            {SITE.closedToNewInvestorsSince ? (
              <p className="rounded-xl border border-line bg-raised px-4 py-3 text-[13px] text-muted">
                {text.closedSince(format.calendarDate(SITE.closedToNewInvestorsSince))}
              </p>
            ) : null}
          </div>
        </aside>
      </section>

      <section className={cn(publicContainer, "pb-12 lg:pb-16")}>
        <h2 className="font-display text-[28px] leading-[34px] font-bold text-accent-300">{text.howItWorks}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <li
              key={fact.title}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-overlay text-accent-400">
                <Icon name={fact.icon} className="size-5" />
              </span>
              <span className="mt-2 font-semibold text-fg">{fact.title}</span>
              <span className="text-sm text-muted">{fact.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cn(publicContainer, "grid gap-6 pb-16 lg:grid-cols-12")}>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8 lg:col-span-7">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-[22px] leading-7 font-bold text-accent-300">{text.latestNews}</h2>
            <Link
              href="/news"
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-accent-400 hover:underline"
            >
              {text.allNews}
              <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="mt-4 text-sm text-subtle">{text.newsEmpty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {latest.map((entry) => (
                <li key={entry.id} className="grid gap-1 py-4 first:pt-2 last:pb-0 sm:grid-cols-12 sm:gap-2">
                  <time dateTime={entry.date} className="font-mono text-[13px] text-muted sm:col-span-3">
                    {format.calendarDate(entry.date)}
                  </time>
                  <p className="text-sm text-fg sm:col-span-9">{entry.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8 lg:col-span-5">
          <h2 className="font-display text-[22px] leading-7 font-bold text-accent-300">{text.contactTitle}</h2>
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
