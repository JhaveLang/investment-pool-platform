import Link from "next/link";
import { PublicPageHeader } from "@/components/public/public-page-header";
import { publicContainer } from "@/components/public/site-layout";
import { Icon } from "@/components/ui/icon";
import { investorGuide, topicIds } from "@/content/investor-guide";
import { getI18n, pageMetadata } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { FEE_PERCENT } from "@/lib/fees";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";
import { getPoolSettings } from "@/server/queries/pool-settings";

export const generateMetadata = pageMetadata((messages) => messages.site.faq);

export default async function FaqPage() {
  const [{ locale, format }, settings] = await Promise.all([getI18n(), getPoolSettings()]);
  const guide = investorGuide[locale];
  const facts = {
    depositMin: format.currency(settings.depositMinCents),
    depositMax: format.currency(settings.depositMaxCents),
    depositsOpen: settings.depositsOpen,
    accrualDays: ACCRUAL_DELAY_DAYS,
    lockDays: MINIMUM_TERM_DAYS,
    payoutDays: PAYOUT_DEADLINE_DAYS,
    bankFee: format.percent(FEE_PERCENT.bank_transfer),
    walletFee: format.percent(FEE_PERCENT.crypto),
    exchangeFee: format.percent(FEE_PERCENT.exchange),
  };

  return (
    <>
      <PublicPageHeader title={guide.faqTitle} description={guide.faqIntro} />
      <div className={cn(publicContainer, "grid items-start gap-8 pt-8 sm:pt-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16")}>
        <aside className="rounded-2xl border border-line bg-well p-5 lg:sticky lg:top-24">
          <nav aria-label={guide.topicsLabel}>
            <h2 className="label-caps text-subtle">{guide.topicsLabel}</h2>
            <ul className="mt-2 divide-y divide-line-strong/60">
              {topicIds.map((id) => (
                <li key={id}><a href={`#${id}`} className="flex items-center justify-between gap-2 py-3 text-sm font-semibold text-accent-400 hover:underline">
                  {guide.topics[id].title}<Icon name="chevronDown" className="size-4 shrink-0" />
                </a></li>
              ))}
            </ul>
          </nav>
        </aside>
        <div className="min-w-0 space-y-10">
          {topicIds.map((id) => {
            const topic = guide.topics[id];
            return (
              <section key={id} id={id} aria-labelledby={`heading-${id}`} className="scroll-mt-24">
                <h2 id={`heading-${id}`} className="mb-3 font-display text-3xl leading-tight font-bold text-accent-300">{topic.title}</h2>
                <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-4 sm:px-6">
                  {topic.questions.map(({ question, answer, source }, index) => (
                    <details key={question} className="group" open={id === "pool" && index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-semibold text-fg hover:text-accent-400 [&::-webkit-details-marker]:hidden">
                        {question}
                        <Icon name="chevronDown" className="size-5 shrink-0 text-accent-400 group-open:rotate-180 motion-safe:transition-transform" />
                      </summary>
                      <p className="max-w-prose pb-5 text-sm leading-relaxed text-muted">
                        {typeof answer === "function" ? answer(facts) : answer}
                        {source && <a href={source.href} className="mt-2 block font-medium text-accent-400 underline">{source.label}</a>}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="rounded-2xl border border-line bg-raised p-6">
            <h2 className="font-display text-2xl font-bold text-accent-300">{guide.helpTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{guide.helpText}</p>
            <Link href="/contact" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent-400 hover:underline">{guide.contactLink}<Icon name="arrowRight" className="size-4" /></Link>
          </section>
        </div>
      </div>
    </>
  );
}
