import Image from "next/image";
import Link from "next/link";
import teamCall from "@/assets/team-call-hd.webp";
import { AccrualPlot, depositTimeline } from "@/components/public/accrual-plot";
import { HeroBackdrop } from "@/components/public/hero-backdrop";
import { RulesTimeline } from "@/components/public/rules-timeline";
import { getAccountLink } from "@/components/public/site-header";
import { publicContainer } from "@/components/public/site-layout";
import { buttonStyles } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { SITE } from "@/config/site";
import { getI18n } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
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
  const days = depositTimeline(todayIsoDate());
  const facts: Array<{ icon: IconName; color: string; title: string; detail: string }> = [
    { icon: "lock", color: "bg-overlay text-accent-400", title: auth.factTermTitle(MINIMUM_TERM_DAYS), detail: auth.factTermDetail },
    { icon: "trendingUp", color: "bg-[#f0f0dc] text-[#575927]", title: auth.factAccrualTitle(ACCRUAL_DELAY_DAYS), detail: auth.factAccrualDetail },
    { icon: "arrowUpRight", color: "bg-indigo/10 text-indigo", title: auth.factPayoutTitle(PAYOUT_DEADLINE_DAYS), detail: auth.factPayoutDetail },
    { icon: "shieldCheck", color: "bg-raised text-accent-300", title: auth.factLedgerTitle, detail: auth.factLedgerDetail },
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
          className={cn(publicContainer, "relative grid items-center gap-8 py-10 sm:py-12 lg:grid-cols-2 lg:py-16")}
        >
          <div className="flex min-w-0 flex-col items-start gap-5 sm:gap-6">
            <span className="flex w-fit items-center gap-2 rounded-full border border-line-strong/70 bg-surface/80 px-3 py-1 text-accent-300">
              <span aria-hidden className="size-1.5 rounded-full bg-accent-300" />
              <span className="label-caps">{text.since(format.month(SITE.foundedMonth))}</span>
            </span>
            <div>
              <h1 className="font-display text-[32px] leading-[1.08] font-bold tracking-[-0.02em] text-balance text-accent-300 sm:text-[52px]">
                {messages.app.name}
              </h1>
              <p className="mt-2 font-display text-[22px] leading-7 font-semibold text-[#6c5770]">{text.tagline}</p>
            </div>
            <p className="max-w-prose text-base leading-relaxed text-pretty text-muted">{text.heroText}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={account.href} className={buttonStyles({ size: "lg" })}>
                <Icon name="lock" className="size-4" />
                {account.label}
              </Link>
              <Link href="/news" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                {text.allNews}
              </Link>
            </div>
            <dl className="grid w-full grid-cols-3 divide-x divide-line-strong/60 border-t border-line-strong/60 pt-4">
              {keyFacts.map((fact) => (
                <div key={fact.label} className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-4">
                  <dt className="label-caps break-words hyphens-auto text-muted">{fact.label}</dt>
                  <dd className="mt-1 font-display text-xl leading-tight font-bold text-accent-300 sm:text-2xl">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="relative isolate overflow-hidden rounded-3xl border border-line-strong/60 bg-surface shadow-xl shadow-accent-300/10">
            <Image
              src={teamCall}
              alt={text.heroImageAlt}
              quality={90}
              sizes="(min-width: 1489px) 624px, (min-width: 1024px) calc(43vw - 16px), (min-width: 640px) 92vw, calc(100vw - 32px)"
              placeholder="blur"
              loading="eager"
              fetchPriority="high"
              className="aspect-[4/3] w-full object-cover object-right"
            />
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-tr from-accent-300/20 via-transparent to-transparent" />
            <figcaption className="absolute bottom-3 left-3 w-fit max-w-[calc(100%-1.5rem)] space-y-2 rounded-2xl border border-line-strong/60 bg-surface/95 p-4 shadow-lg backdrop-blur-sm sm:bottom-4 sm:left-4">
              <div className="flex items-center justify-between gap-4">
                <span className="label-caps flex items-center gap-1 text-muted">
                  <span aria-hidden className="size-2 rounded-full bg-accent-400" />
                  {text.poolLedger}
                </span>
                <span className="font-mono text-xs font-medium text-accent-300">{text.ledgerAccess}</span>
              </div>
              <a href="#accrual-curve" aria-label={text.exploreAccrual} className="group flex items-end justify-between gap-4 rounded">
                <div>
                  <p className="text-base leading-6 font-semibold text-accent-300 group-hover:underline">{text.dailyReturns}</p>
                  <p className="text-sm leading-5 text-muted">{text.dailyCalculation}</p>
                </div>
                <AccrualPlot days={days} compact />
              </a>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className={cn(publicContainer, "grid gap-5 py-10 sm:py-12 lg:grid-cols-2 lg:gap-8 lg:py-16")}>
        <div className="flex min-w-0 flex-col justify-between gap-6 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="label-caps block text-muted">{text.ledgerLabel}</span>
              <h2 className="mt-1 font-display text-[22px] leading-7 font-bold text-accent-300">{text.ledgerTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text.ledgerText}</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center bg-well text-accent-400">
              <Icon name="trendingUp" className="size-5" />
            </span>
          </div>
          <RulesTimeline days={days} />
        </div>

        <article className="flex min-w-0 flex-col justify-between gap-6 rounded-3xl border border-line bg-surface p-5 shadow-lg shadow-accent-300/8 sm:p-8">
          <div className="flex flex-col gap-5">
            <div>
              <span className="label-caps block text-muted">{text.forInvestors}</span>
              <h2 className="mt-1 font-display text-[28px] leading-[34px] font-bold text-accent-300">
                {text.accountTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text.accountText}</p>
            </div>
            <ul className="space-y-3">
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
              <p className="flex items-start gap-2 rounded-xl border border-line bg-raised px-4 py-3 text-[13px] text-muted">
                <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
                {text.closedSince(format.calendarDate(SITE.closedToNewInvestorsSince))}
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className={cn(publicContainer, "pb-12 lg:pb-16")}>
        <h2 className="font-display text-[28px] leading-[34px] font-bold text-accent-300">{text.howItWorks}</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {facts.map((fact) => (
            <li
              key={fact.title}
              className="grid grid-cols-[auto_1fr] items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:flex sm:flex-col sm:p-6"
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", fact.color)}>
                <Icon name={fact.icon} className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold text-fg">{fact.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{fact.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={cn(publicContainer, "grid items-stretch gap-6 lg:grid-cols-12")}>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
                <li key={entry.id} className="grid items-baseline gap-1 py-4 first:pt-2 last:pb-0 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <time dateTime={entry.date} className="font-mono text-[13px] text-subtle">
                    {format.calendarDate(entry.date)}
                  </time>
                  <p className="min-w-0 text-sm leading-relaxed wrap-anywhere text-fg">{entry.text}</p>
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
