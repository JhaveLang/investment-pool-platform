import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import { segmentStyles } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import type { AccountOverview } from "@/server/queries/investor";

/** The switch between deposit and withdrawal and the balance they start from. */
export async function MoveMoneyHeader({
  active,
  overview,
}: {
  active: "deposit" | "withdraw";
  overview: AccountOverview;
}) {
  const { messages, format } = await getI18n();
  const tabs = [
    { key: "deposit", href: "/deposit", label: messages.deposits.switchLabel, icon: "arrowDownLeft" },
    { key: "withdraw", href: "/withdraw", label: messages.withdrawals.switchLabel, icon: "arrowUpRight" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">{active === "deposit" ? messages.deposits.title : messages.withdrawals.title}</h1>
      <nav aria-label={messages.nav.moveMoney} className="grid grid-cols-2 gap-2 lg:max-w-xl">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(segmentStyles(isActive, "lg"), "px-3")}
            >
              <Icon name={tab.icon} className="size-5" />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      <section className="flex items-stretch justify-between gap-4 rounded-xl bg-raised p-4 sm:p-5">
        <div className="min-w-0">
          <p className="label-caps text-muted">{messages.dashboard.balance}</p>
          <p className="amount mt-1 font-display text-[clamp(1.375rem,6vw,2rem)] leading-tight font-bold text-fg">
            {format.currency(overview.balanceCents)}
          </p>
        </div>
        <div className="min-w-0 border-l border-overlay pl-4 text-right">
          <p className="label-caps text-muted">{messages.dashboard.available}</p>
          <p className="amount mt-1 flex items-center justify-end gap-1.5 font-display text-[clamp(1.125rem,5vw,1.5rem)] leading-tight font-bold text-accent-400">
            <span aria-hidden className="size-2 rounded-full bg-accent-400" />
            {format.currency(overview.availableCents)}
          </p>
        </div>
      </section>
    </div>
  );
}
