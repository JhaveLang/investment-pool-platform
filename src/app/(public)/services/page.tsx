import Image from "next/image";
import Link from "next/link";
import portrait from "@/assets/service-portrait.webp";
import statement from "@/assets/service-statement.webp";
import account from "@/assets/service-account.webp";
import { publicContainer } from "@/components/public/site-layout";
import { buttonStyles } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { investorGuide, topicIds } from "@/content/investor-guide";
import { getI18n, pageMetadata } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { FEE_PERCENT, PAYMENT_METHODS } from "@/lib/fees";

export const generateMetadata = pageMetadata((messages) => messages.site.services);

const topicIcons: Record<(typeof topicIds)[number], IconName> = { pool: "globe", returns: "receipt", payments: "swap" };

export default async function ServicesPage() {
  const { messages, locale, format } = await getI18n();
  const guide = investorGuide[locale];
  return (
    <>
      <section className="grid-backdrop border-b border-line bg-well">
        <div className={cn(publicContainer, "grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[5fr_6fr] lg:gap-14 lg:py-16")}>
          <div>
            <h1 className="font-display text-5xl leading-none font-bold tracking-tight text-accent-300 sm:text-6xl lg:text-7xl">{messages.site.services}</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">{guide.servicesIntro}</p>
            <Link href="/faq" className={buttonStyles({ className: "mt-6" })}>{guide.faqLink}<Icon name="arrowRight" className="size-4" /></Link>
          </div>
          <div aria-hidden="true" className="mx-auto grid w-full max-w-[42rem] grid-cols-3 items-center gap-2 pb-4 sm:gap-3 sm:pb-6">
            {[portrait, statement, account].map((photo, index) => (
              <Image key={photo.src} src={photo} alt="" sizes="(min-width: 1280px) 216px, (min-width: 1024px) 15vw, (min-width: 768px) 210px, 30vw"
                className={cn("aspect-[3/4] w-full rounded-xl object-cover shadow-sm sm:rounded-2xl", index === 1 && "translate-y-4 sm:translate-y-6")} />
            ))}
          </div>
        </div>
      </section>

      <div className={cn(publicContainer, "pt-10 sm:pt-14")}>
        <div className="grid gap-5 md:grid-cols-3">
          {topicIds.map((id) => {
            const topic = guide.topics[id];
            return (
              <article key={id} className="flex flex-col items-start rounded-2xl border border-line bg-surface p-6 lg:p-7">
                <span className="mb-5 grid size-10 place-items-center rounded-lg bg-well text-accent-400"><Icon name={topicIcons[id]} className="size-5" /></span>
                <h2 className="font-display text-2xl leading-tight font-bold text-accent-300">{topic.title}</h2>
                <p className="mt-3 mb-6 text-sm leading-relaxed text-muted">{topic.summary}</p>
                <Link href={`/faq#${id}`} className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-accent-400 hover:underline">
                  {topic.link}<Icon name="arrowRight" className="size-4 shrink-0" />
                </Link>
              </article>
            );
          })}
        </div>
        <section className="mt-8 grid items-center gap-6 rounded-2xl bg-accent-300 p-6 text-white sm:p-8 lg:grid-cols-[4fr_5fr] lg:gap-12">
          <div>
            <h2 className="font-display text-3xl font-bold">{guide.feesTitle}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">{guide.feesIntro}</p>
          </div>
          <dl className="grid divide-y divide-white/25 border-t border-white/25 pt-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:pt-5 lg:border-t-0 lg:pt-0">
            {PAYMENT_METHODS.map((method) => (
              <div key={method} className="flex min-w-0 items-baseline justify-between gap-3 py-2 sm:block sm:px-3 sm:py-0 sm:first:pl-0 lg:px-5">
                <dt className="text-sm text-white/85">{guide.feeMethods[method]}</dt>
                <dd className="font-display text-3xl font-bold sm:mt-1 sm:text-4xl">{format.percent(FEE_PERCENT[method])}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
