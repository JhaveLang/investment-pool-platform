import {
  approveWithdrawalAction,
  reconcileDepositAction,
  rejectDepositAction,
  rejectWithdrawalAction,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/format";
import { formatPayoutDestination } from "@/lib/iban";
import { payoutDeadline } from "@/lib/returns";
import type { DepositReviewRow, WithdrawalReviewRow } from "@/server/queries/admin";
import { InvestorCode } from "./investor-code";
import { ReviewActions } from "./review-actions";

type ApprovalQueueProps = {
  withdrawals: WithdrawalReviewRow[];
  deposits: DepositReviewRow[];
};

/** Open withdrawals and unreconciled deposits as cards with their decision controls. */
export async function ApprovalQueue({ withdrawals, deposits }: ApprovalQueueProps) {
  const { messages, format } = await getI18n();
  const text = messages.admin;
  const reviewText = text.review;
  const today = todayIsoDate();

  if (withdrawals.length === 0 && deposits.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface px-5 py-6 text-center text-[13px] text-muted">
        {text.queueEmpty}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 2xl:grid-cols-2">
      {withdrawals.map((withdrawal) => {
        const dueOn = payoutDeadline(formatIsoDate(withdrawal.createdAt));
        const isOverdue = dueOn < today;
        return (
          <li key={withdrawal.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-warn">
                  <Icon name="arrowUpRight" className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-semibold text-fg">
                    {withdrawal.investorName} <InvestorCode code={withdrawal.investorCode} />
                  </p>
                  <p className="truncate text-xs text-muted">
                    <span className="reference">{withdrawal.reference}</span>,{" "}
                    {messages.paymentMethods[withdrawal.method]}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={isOverdue ? "danger" : "warning"}>
                      {isOverdue ? text.overdue : messages.columns.payoutDue(format.calendarDate(dueOn))}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg bg-well p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted">{text.payoutRequest}</span>
                <span className="amount font-display text-xl font-bold text-loss">
                  {format.signedCurrency(-withdrawal.amountCents)}
                </span>
              </div>
              <p className="reference truncate text-xs text-subtle">{formatPayoutDestination(withdrawal)}</p>
            </div>
            <ReviewActions
              approveAction={approveWithdrawalAction.bind(null, withdrawal.id)}
              rejectAction={rejectWithdrawalAction.bind(null, withdrawal.id)}
              approveLabel={reviewText.approve}
              rejectLabel={reviewText.reject}
            />
          </li>
        );
      })}
      {deposits.map((deposit) => {
        const bookedOn = formatIsoDate(deposit.createdAt);
        return (
          <li key={deposit.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-accent-400">
                  <Icon name="bank" className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-semibold text-fg">
                    {deposit.investorName} <InvestorCode code={deposit.investorCode} />
                  </p>
                  <p className="truncate text-xs text-muted">
                    <span className="reference">{deposit.reference}</span>, {format.dateTime(deposit.createdAt)}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone="info">{messages.depositStatus.pending}</Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-well p-3">
              <div className="min-w-0">
                <p className="text-[13px] text-muted">{text.incomingPayment}</p>
                <p className="truncate text-xs text-subtle">{messages.paymentMethods[deposit.method]}</p>
              </div>
              <span className="amount font-display text-xl font-bold text-accent-400">
                {format.signedCurrency(deposit.amountCents)}
              </span>
            </div>
            <ReviewActions
              approveAction={reconcileDepositAction.bind(null, deposit.id)}
              rejectAction={rejectDepositAction.bind(null, deposit.id)}
              approveLabel={reviewText.reconcile}
              rejectLabel={reviewText.cancelDeposit}
              receivedOn={{ defaultValue: bookedOn, min: bookedOn, max: today }}
            />
          </li>
        );
      })}
    </ul>
  );
}
