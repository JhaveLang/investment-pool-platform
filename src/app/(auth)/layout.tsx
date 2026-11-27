import Image from "next/image";
import type { ReactNode } from "react";
import teamCall from "@/assets/team-call-hd.webp";
import { Brand } from "@/components/layout/brand";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { HeroBackdrop } from "@/components/public/hero-backdrop";
import { Icon, type IconName } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";

/** The pool introduction sits beside the sign-in form on desktop and above it on phones. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { messages } = await getI18n();
  const text = messages.auth;
  const facts: Array<{ icon: IconName; title: string; detail: string }> = [
    { icon: "lock", title: text.factTermTitle(MINIMUM_TERM_DAYS), detail: text.factTermDetail },
    { icon: "trendingUp", title: text.factAccrualTitle(ACCRUAL_DELAY_DAYS), detail: text.factAccrualDetail },
    { icon: "arrowUpRight", title: text.factPayoutTitle(PAYOUT_DEADLINE_DAYS), detail: text.factPayoutDetail },
    { icon: "shieldCheck", title: text.factLedgerTitle, detail: text.factLedgerDetail },
  ];

  return (
    <main className="grid-backdrop relative isolate flex flex-1 flex-col px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-10 sm:px-6 lg:px-8">
      <HeroBackdrop />
      <div className="relative flex items-center justify-between gap-4 py-2">
        <Brand />
        <LocaleSwitcher />
      </div>

      <div className="relative mx-auto grid w-full max-w-xl flex-1 content-center gap-5 py-5 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-12 lg:py-8">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          <div className="relative isolate flex min-h-36 items-center overflow-hidden bg-raised p-5 sm:p-7 lg:min-h-64 lg:p-8">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[78%] [mask-image:linear-gradient(to_right,transparent,black_25%)] lg:w-[74%]">
              <Image
                src={teamCall}
                alt=""
                fill
                sizes="(min-width: 1216px) 492px, (min-width: 1024px) calc(74vw - 408px), (min-width: 608px) 450px, calc(78vw - 25px)"
                quality={90}
                placeholder="blur"
                loading="eager"
                fetchPriority="high"
                className="object-cover object-[center_20%]"
              />
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-r from-canvas via-canvas/85 via-45% to-transparent to-75%" />
            <div className="relative w-[57%]">
              <span className="hidden w-fit items-center gap-1.5 rounded-full border border-accent-400/25 bg-surface/85 px-2.5 py-1 text-accent-400 lg:flex">
                <span aria-hidden className="size-1.5 rounded-full bg-accent-400 motion-safe:animate-pulse" />
                <span className="label-caps">{text.heroEyebrow}</span>
              </span>
              <p className="mt-4 hidden font-display text-[clamp(2rem,3vw,2.75rem)] leading-[1.08] font-bold tracking-[-0.03em] text-accent-300 lg:block">
                {text.heroTitle}
              </p>
              <p className="text-sm leading-relaxed text-muted lg:mt-3 lg:text-base">{messages.app.description}</p>
            </div>
          </div>
          <ul className="hidden grid-cols-2 gap-3 p-5 lg:grid">
            {facts.map((fact) => (
              <li key={fact.title} className="flex flex-col gap-2 rounded-xl bg-overlay/60 p-4">
                <span className="grid size-9 place-items-center rounded-lg bg-accent-400/10 text-accent-400">
                  <Icon name={fact.icon} className="size-[18px]" />
                </span>
                <span className="font-display text-[15px] font-semibold text-fg">{fact.title}</span>
                <span className="text-[13px] text-muted">{fact.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="w-full min-w-0">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_16px_32px_-8px_rgba(29,22,33,0.16)] sm:p-8">
            {children}
          </div>
          <ul className="mt-6 flex flex-col gap-2 lg:hidden">
            {facts.slice(0, 3).map((fact) => (
              <li key={fact.title} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-400/10 text-accent-400">
                  <Icon name={fact.icon} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-fg">{fact.title}</span>
                  <span className="block truncate text-xs text-muted">{fact.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
