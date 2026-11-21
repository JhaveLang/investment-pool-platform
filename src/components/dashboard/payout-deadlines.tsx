import { InvestorCode } from "@/components/admin/investor-code";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardLink } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { daysBetween, todayIsoDate } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatIsoDate } from "@/lib/format";
import { PAYOUT_DEADLINE_DAYS, payoutDeadline } from "@/lib/returns";
import type { WithdrawalReviewRow } from "@/server/queries/admin";

/** Open withdrawals, oldest first, with a bar for how much of the 7-day payout deadline has passed. */
export async function PayoutDeadlines({ withdrawals }: { withdrawals: WithdrawalReviewRow[] }) {
  const { messages, format } = await getI18n();
  const text = messages.admin;
  const today = todayIsoDate();

  return (
    <Card>
      <CardHeader
        title={text.payoutDeadlinesTitle}
        action={withdrawals.length > 0 ? <CardLink href="/admin/withdrawals">{text.reviewNow}</CardLink> : undefined}
      />
      {withdrawals.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">{text.payoutDeadlinesEmpty}</p>
      ) : (
        <ul className="space-y-2 px-3 pb-3">
          {withdrawals.map((withdrawal) => {
            const requestedOn = formatIsoDate(withdrawal.createdAt);
            const dueOn = payoutDeadline(requestedOn);
            const elapsedDays = Math.min(PAYOUT_DEADLINE_DAYS, Math.max(0, daysBetween(requestedOn, today)));
            const isOverdue = dueOn < today;
            const progressLabel = text.payoutDeadlineDays(elapsedDays, PAYOUT_DEADLINE_DAYS);
            return (
              <li key={withdrawal.id} className="rounded-xl bg-raised/50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">
                      {withdrawal.investorName} <InvestorCode code={withdrawal.investorCode} />
                    </p>
                    <p className="amount text-xs text-subtle">{format.currency(withdrawal.amountCents)}</p>
                  </div>
                  {isOverdue ? (
                    <Badge tone="danger">{text.overdue}</Badge>
                  ) : (
                    <Badge tone="info">{messages.columns.payoutDue(format.calendarDate(dueOn))}</Badge>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-label={progressLabel}
                  aria-valuemin={0}
                  aria-valuemax={PAYOUT_DEADLINE_DAYS}
                  aria-valuenow={elapsedDays}
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-overlay"
                >
                  <div
                    className={cn("h-full rounded-full", isOverdue ? "bg-loss" : "bg-accent-400")}
                    style={{ width: `${(elapsedDays / PAYOUT_DEADLINE_DAYS) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-subtle">{progressLabel}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
