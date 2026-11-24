import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import type { DatedValue } from "@/components/charts/geometry";
import { buttonStyles } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import type { AccountOverview } from "@/server/queries/investor";

type BalanceHeroProps = {
  overview: AccountOverview;
  /** End-of-day balances for the sparkline, oldest first. */
  trend: DatedValue[];
  latestRate: { month: string; ratePpm: number } | null;
};

/**
 * The balance in one component for both layouts: a full-width hero card with the
 * available/locked split and the two actions on phones, the first key-figure card on desktop.
 */
export async function BalanceHero({ overview, trend, latestRate }: BalanceHeroProps) {
  const { messages, format } = await getI18n();
  const text = messages.dashboard;

  return (
    <section className="ambient-glow @container col-span-full flex flex-col rounded-xl bg-raised p-4 shadow-xl lg:col-span-1 lg:border lg:border-line lg:bg-surface lg:shadow-none lg:before:hidden lg:after:hidden">
      <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
        <span className="label-caps flex items-center gap-1.5 text-muted">
          <Icon name="shieldCheck" className="size-[18px] text-accent-400" />
          {text.accountLabel}
        </span>
        {latestRate ? (
          <span className="flex items-center gap-1.5 rounded-full bg-overlay/80 px-2 py-0.5 text-xs font-medium text-accent-400">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-400 motion-safe:animate-pulse" />
            {text.poolResultShort(format.rate(latestRate.ratePpm))}
          </span>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="label-caps text-muted">{text.balance}</h2>
          <p
            className="mt-0.5 font-display text-[32px] leading-10 font-bold tracking-tight whitespace-nowrap text-fg lg:mt-1 lg:text-[length:clamp(1.125rem,11cqi,1.5rem)] lg:leading-tight"
            data-testid="account-balance"
          >
            {format.currency(overview.balanceCents)}
          </p>
          {overview.pendingDepositCents > 0 || overview.reservedCents > 0 ? (
            <p className="amount mt-1 flex flex-col text-xs text-muted">
              {overview.pendingDepositCents > 0 ? (
                <span>{text.pendingDeposits(format.currency(overview.pendingDepositCents))}</span>
              ) : null}
              {overview.reservedCents > 0 ? (
                <span>{text.reservedPayouts(format.currency(overview.reservedCents))}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {overview.totalReturnsCents !== 0 ? (
        <p className="mt-1 text-xs lg:hidden">
          <span className={overview.totalReturnsCents > 0 ? "font-medium text-gain" : "font-medium text-loss"}>
            {format.signedCurrency(overview.totalReturnsCents)}
          </span>{" "}
          <span className="text-muted">{text.returnsBookedSuffix}</span>
        </p>
      ) : null}

      <Sparkline id="hero-balance" values={trend} className="mt-4 h-10 w-full lg:hidden" />

      <div className="mt-auto hidden flex-col gap-2 pt-4 lg:flex">
        <div className="min-w-0">
          <p className="label-caps text-muted">{text.netDeposits}</p>
          <p className="amount text-[13px] font-semibold text-fg">{format.currency(overview.totalDepositedCents)}</p>
        </div>
        <Sparkline id="kpi-balance" values={trend} className="h-9 w-full" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
        <div className="rounded-lg bg-overlay/60 p-2.5">
          <p className="label-caps flex items-center gap-1 text-muted">
            <Icon name="wallet" className="size-[15px] text-accent-400" />
            {text.availableShort}
          </p>
          <p className="amount mt-1 font-display text-lg font-semibold text-fg">
            {format.currency(overview.availableCents)}
          </p>
          <p className="text-xs text-muted">{text.availableNow}</p>
        </div>
        <div className="rounded-lg bg-overlay/60 p-2.5">
          <p className="label-caps flex items-center gap-1 text-muted">
            <Icon name="lock" className="size-[15px] text-warn" />
            {text.lockedShort}
          </p>
          <p className="amount mt-1 font-display text-lg font-semibold text-fg">
            {format.currency(overview.lockedCents)}
          </p>
          <p className="text-xs text-muted">
            {overview.nextUnlockOn ? text.freeFrom(format.calendarDate(overview.nextUnlockOn)) : text.nothingLocked}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
        <Link href="/deposit" className={buttonStyles({ className: "h-12" })}>
          <Icon name="plusCircle" className="size-[18px]" />
          {messages.nav.deposit}
        </Link>
        <Link href="/withdraw" className={buttonStyles({ variant: "secondary", className: "h-12" })}>
          <Icon name="arrowUp" className="size-[18px] text-muted" />
          {messages.nav.withdraw}
        </Link>
      </div>
    </section>
  );
}
