import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import { daysBetween, todayIsoDate } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/format";
import { PAYOUT_DEADLINE_DAYS, payoutDeadline } from "@/lib/returns";
import type { RecentDeposit, RecentWithdrawal } from "@/server/queries/investor";
import { Meter } from "./meter";

type OpenRequestsProps = {
  deposits: RecentDeposit[];
  withdrawals: RecentWithdrawal[];
};

type OpenRequest = { kind: "withdrawal"; row: RecentWithdrawal } | { kind: "deposit"; row: RecentDeposit };

/**
 * The investor's requests still under review, newest first: withdrawals against their 7-day payout deadline and
 * unreconciled deposits.
 */
export async function OpenRequests({ deposits, withdrawals }: OpenRequestsProps) {
  const { messages } = await getI18n();
  const text = messages.dashboard;
  const openRequests: OpenRequest[] = [
    ...withdrawals.filter((row) => row.status === "pending").map((row) => ({ kind: "withdrawal" as const, row })),
    ...deposits.filter((row) => row.status === "pending").map((row) => ({ kind: "deposit" as const, row })),
  ].sort((left, right) => right.row.createdAt.getTime() - left.row.createdAt.getTime());

  return (
    <Card className="min-w-0">
      <CardHeader
        title={text.openRequestsTitle}
        icon="clock"
        action={
          openRequests.length > 0 ? <Badge tone="warning">{text.openCount(openRequests.length)}</Badge> : undefined
        }
      />
      {openRequests.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-muted">{text.openEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2 px-3 pb-3">
          {openRequests.map((request) =>
            request.kind === "withdrawal" ? (
              <PendingWithdrawal key={request.row.id} withdrawal={request.row} />
            ) : (
              <PendingDeposit key={request.row.id} deposit={request.row} />
            ),
          )}
        </ul>
      )}
    </Card>
  );
}

async function PendingWithdrawal({ withdrawal }: { withdrawal: RecentWithdrawal }) {
  const { messages, format } = await getI18n();
  const text = messages.dashboard;
  const requestedOn = formatIsoDate(withdrawal.createdAt);
  const elapsedDays = Math.min(PAYOUT_DEADLINE_DAYS, Math.max(0, daysBetween(requestedOn, todayIsoDate())));
  const progressLabel = text.dayOf(elapsedDays, PAYOUT_DEADLINE_DAYS);
  return (
    <li className="rounded-lg bg-raised p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warn/10 text-warn">
            <Icon name="arrowUpRight" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{text.withdrawalRequest}</p>
            <p className="truncate text-xs text-muted">{messages.paymentMethods[withdrawal.method]}</p>
            <div className="mt-1.5">
              <Badge tone="warning">{messages.withdrawalStatus.pending}</Badge>
            </div>
          </div>
        </div>
        <span className="amount shrink-0 text-sm font-bold text-loss">
          {format.signedCurrency(-withdrawal.amountCents)}
        </span>
      </div>
      <div className="mt-3">
        <Meter value={elapsedDays / PAYOUT_DEADLINE_DAYS} className="bg-warn" label={progressLabel} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-xs">
        <span className="text-muted">{progressLabel}</span>
        <span className="font-medium text-warn">
          {messages.columns.payoutDue(format.calendarDate(payoutDeadline(requestedOn)))}
        </span>
      </div>
    </li>
  );
}

async function PendingDeposit({ deposit }: { deposit: RecentDeposit }) {
  const { messages, format } = await getI18n();
  return (
    <li className="rounded-lg bg-raised p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gain/10 text-gain">
            <Icon name="arrowDownLeft" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{messages.entryTypes.deposit}</p>
            <p className="text-xs break-words hyphens-auto text-muted">
              {messages.paymentMethods[deposit.method]}, {format.dateTime(deposit.createdAt)}
            </p>
          </div>
        </div>
        <span className="amount shrink-0 text-sm font-bold text-gain">
          {format.signedCurrency(deposit.amountCents - deposit.feeCents)}
        </span>
      </div>
      {/* Below the amount's row, indented past the icon: next to the amount, the badge overflowed narrow phones. */}
      <div className="mt-1.5 pl-11.5">
        <Badge tone="warning">{messages.depositStatus.pending}</Badge>
      </div>
    </li>
  );
}
