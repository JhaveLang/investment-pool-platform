import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Icon, type IconName } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";

/** Sign-in: the pool's rules on a glass panel beside the form from `lg`, stacked on phones. */
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
    <main className="relative flex flex-1 flex-col px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4 py-2">
        <Brand />
        <LocaleSwitcher />
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12">
        <section className="ambient-glow hidden flex-col gap-8 rounded-2xl bg-raised p-10 shadow-xl lg:flex">
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-400/25 bg-accent-400/10 px-2.5 py-1 text-accent-400">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-400 motion-safe:animate-pulse" />
            <span className="label-caps">{text.heroEyebrow}</span>
          </span>
          <div>
            <p className="font-display text-[44px] leading-[52px] font-bold tracking-[-0.03em] text-fg">
              {text.heroTitle}
            </p>
            <p className="mt-4 max-w-md text-base text-muted">{messages.app.description}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3">
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

        <div className="w-full">
          <p className="mb-6 text-center text-sm text-muted lg:hidden">{messages.app.description}</p>
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
