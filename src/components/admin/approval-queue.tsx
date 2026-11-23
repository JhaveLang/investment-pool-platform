import {
  approveWithdrawalAction,
  reconcileDepositAction,
  rejectDepositAction,
  rejectWithdrawalAction,
} from "@/actions/admin";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Popup } from "@/components/ui/popup";
import { getI18n } from "@/i18n/server";
import { groupByAccount, type QueueGroup } from "@/lib/approval-queue";
import { todayIsoDate } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatIsoDate } from "@/lib/format";
import { formatPayoutDestination } from "@/lib/iban";
import { payoutDeadline } from "@/lib/returns";
import type { DepositReviewRow, WithdrawalReviewRow } from "@/server/queries/admin";
import { InvestorCode } from "./investor-code";
import { ReviewActions } from "./review-actions";

type ApprovalQueueProps = {
  withdrawals: WithdrawalReviewRow[];
  deposits: DepositReviewRow[];
  /** Show at most this many cards (one per investor). */
  limit?: number;
};

type QueueItem = ({ kind: "withdrawal"; row: WithdrawalReviewRow } | { kind: "deposit"; row: DepositReviewRow }) & {
  accountId: string;
  createdAt: Date;
};

/** In the popup's grid the cards pop in one after another; later ones share the last delay. */
const POP_IN_STEP_MS = 60;
const POP_IN_MAX_STEPS = 8;

function popInStyle(index: number | undefined): CSSProperties | undefined {
  return index === undefined
    ? undefined
    : { animationDelay: `${Math.min(index, POP_IN_MAX_STEPS) * POP_IN_STEP_MS}ms` };
}

/**
 * Open withdrawals and unreconciled deposits, one card per investor, the investor with the newest request first. A
 * single request shows as its card with the decision controls; several show as one card with their count, which
 * opens all of them in a grid.
 */
export async function ApprovalQueue({ withdrawals, deposits, limit }: ApprovalQueueProps) {
  const { messages } = await getI18n();
  const items: QueueItem[] = [
    ...withdrawals.map((row) => ({
      kind: "withdrawal" as const,
      row,
      accountId: row.accountId,
      createdAt: row.createdAt,
    })),
    ...deposits.map((row) => ({ kind: "deposit" as const, row, accountId: row.accountId, createdAt: row.createdAt })),
  ];
  const groups = groupByAccount(items).slice(0, limit);

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface px-5 py-6 text-center text-[13px] text-muted">
        {messages.admin.queueEmpty}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 2xl:grid-cols-2">
      {groups.map((group) =>
        group.entries.length > 1 ? (
          <GroupCard key={group.accountId} group={group} />
        ) : (
          <RequestCard key={group.accountId} item={group.entries[0]} />
        ),
      )}
    </ul>
  );
}

function RequestCard({ item, popIndex }: { item: QueueItem; popIndex?: number }) {
  return item.kind === "withdrawal" ? (
    <WithdrawalCard withdrawal={item.row} popIndex={popIndex} />
  ) : (
    <DepositCard deposit={item.row} popIndex={popIndex} />
  );
}

/** Several open requests of one investor: their count and totals; a click opens every request in a grid. */
async function GroupCard({ group }: { group: QueueGroup<QueueItem> }) {
  const { messages, format } = await getI18n();
  const text = messages.admin.queueGroup;
  const newest = group.entries[0].row;
  const count = group.entries.length;
  const depositRows = group.entries.flatMap((item) => (item.kind === "deposit" ? [item.row] : []));
  const withdrawalRows = group.entries.flatMap((item) => (item.kind === "withdrawal" ? [item.row] : []));
  const total = (rows: Array<{ amountCents: number }>) => rows.reduce((sum, row) => sum + row.amountCents, 0);
  // The most urgent payout of the group decides the badge.
  const earliestDue = withdrawalRows.map((row) => payoutDeadline(formatIsoDate(row.createdAt))).sort()[0];
  const isOverdue = earliestDue !== undefined && earliestDue < todayIsoDate();

  return (
    <li className="min-w-0">
      <Popup
        size="wide"
        title={text.title(newest.investorName)}
        description={text.description(count)}
        triggerLabel={text.showAll(newest.investorName, count)}
        triggerClassName="group flex h-full w-full min-w-0 cursor-pointer flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent-400/40 hover:bg-raised/40"
        trigger={
          <>
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-accent-400">
                  <Icon name="users" className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-[15px] font-semibold text-fg">
                    {newest.investorName} <InvestorCode code={newest.investorCode} />
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {text.latest(format.dateTime(newest.createdAt))}
                  </span>
                  <span className="mt-1.5 block">
                    {earliestDue === undefined ? (
                      <Badge tone="info">{messages.depositStatus.pending}</Badge>
                    ) : (
                      <Badge tone={isOverdue ? "danger" : "warning"}>
                        {isOverdue
                          ? messages.admin.overdue
                          : messages.columns.payoutDue(format.calendarDate(earliestDue))}
                      </Badge>
                    )}
                  </span>
                </span>
              </span>
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-400 font-display text-sm font-bold text-accent-ink shadow-[0_0_0_4px_rgba(78,222,163,0.15)]"
              >
                {count}
              </span>
            </span>
            <span className="flex flex-col gap-1.5 rounded-lg bg-well p-3">
              {depositRows.length > 0 ? (
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-muted">{text.deposits(depositRows.length)}</span>
                  <span className="amount font-display text-lg font-bold text-accent-400">
                    {format.signedCurrency(total(depositRows))}
                  </span>
                </span>
              ) : null}
              {withdrawalRows.length > 0 ? (
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-muted">{text.withdrawals(withdrawalRows.length)}</span>
                  <span className="amount font-display text-lg font-bold text-loss">
                    {format.signedCurrency(-total(withdrawalRows))}
                  </span>
                </span>
              ) : null}
            </span>
            <span className="mt-auto flex items-center justify-end gap-1 text-[13px] font-semibold text-accent-400">
              {text.showAllShort(count)}
              <Icon name="chevronRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </>
        }
      >
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {group.entries.map((item, index) => (
            <RequestCard key={item.row.id} item={item} popIndex={index} />
          ))}
        </ul>
      </Popup>
    </li>
  );
}

const cardStyles = "flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4";
const popInStyles = "motion-safe:animate-pop-in";

async function WithdrawalCard({ withdrawal, popIndex }: { withdrawal: WithdrawalReviewRow; popIndex?: number }) {
  const { messages, format } = await getI18n();
  const text = messages.admin;
  const dueOn = payoutDeadline(formatIsoDate(withdrawal.createdAt));
  const isOverdue = dueOn < todayIsoDate();
  return (
    <li className={cn(cardStyles, popIndex !== undefined && popInStyles)} style={popInStyle(popIndex)}>
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
              <span className="reference">{withdrawal.reference}</span>, {messages.paymentMethods[withdrawal.method]}
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
        approveLabel={text.review.approve}
        rejectLabel={text.review.reject}
      />
    </li>
  );
}

async function DepositCard({ deposit, popIndex }: { deposit: DepositReviewRow; popIndex?: number }) {
  const { messages, format } = await getI18n();
  const text = messages.admin;
  const bookedOn = formatIsoDate(deposit.createdAt);
  return (
    <li className={cn(cardStyles, popIndex !== undefined && popInStyles)} style={popInStyle(popIndex)}>
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
        approveLabel={text.review.reconcile}
        rejectLabel={text.review.cancelDeposit}
        receivedOn={{ defaultValue: bookedOn, min: bookedOn, max: todayIsoDate() }}
      />
    </li>
  );
}
