import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { segmentStyles } from "@/components/ui/segmented";
import { getI18n } from "@/i18n/server";
import { FEE_PERCENT, PAYMENT_METHODS, type PaymentMethod } from "@/lib/fees";

const methodIcons: Record<PaymentMethod, IconName> = {
  bank_transfer: "bank",
  crypto: "wallet",
  exchange: "swap",
};

/**
 * A preview of the deposit console with the real routes and fees. The forms themselves live on
 * /deposit and /withdraw, which don't auto-refresh, so a booking key never changes mid-submit.
 */
export async function MoveMoneyPreview({ availableCents }: { availableCents: number }) {
  const { messages, format } = await getI18n();
  const text = messages.dashboard;

  return (
    <Card>
      <CardHeader
        title={text.moveMoneyTitle}
        icon="swap"
        action={<Badge tone="success">{text.creditedInstantly}</Badge>}
      />
      <div className="flex flex-col gap-4 px-5 pb-5">
        <div className="grid grid-cols-2 gap-1">
          <Link href="/deposit" className={segmentStyles(true)}>
            {messages.nav.deposit}
          </Link>
          <Link href="/withdraw" className={segmentStyles(false)}>
            {messages.nav.withdraw}
          </Link>
        </div>
        <div>
          <p className="label-caps mb-2 text-muted">{text.paymentRoutes}</p>
          <ul className="flex flex-col gap-1.5">
            {PAYMENT_METHODS.map((method) => (
              <li key={method} className="flex items-center gap-3 rounded-lg bg-raised px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-overlay text-accent-400">
                  <Icon name={methodIcons[method]} className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg">
                  {messages.paymentMethods[method]}
                </span>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted">
                  {messages.deposits.creditShare(format.percent(100 - FEE_PERCENT[method]))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="label-caps text-muted">{text.available}</span>
          <span className="amount font-semibold text-fg">{format.currency(availableCents)}</span>
        </div>
        <Link href="/deposit" className={buttonStyles({ size: "lg", className: "w-full" })}>
          <Icon name="plusCircle" className="size-[18px]" />
          {text.depositCta}
        </Link>
      </div>
    </Card>
  );
}
