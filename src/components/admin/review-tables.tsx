import {
  approveWithdrawalAction,
  reconcileDepositAction,
  rejectDepositAction,
  rejectWithdrawalAction,
} from "@/actions/admin";
import { DepositStatusBadge, WithdrawalStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { formatPayoutDestination } from "@/lib/iban";
import { payoutDeadline } from "@/lib/returns";
import type { DepositReviewRow, WithdrawalReviewRow } from "@/server/queries/admin";
import { InvestorCode } from "./investor-code";
import { ReviewActions } from "./review-actions";

function InvestorCell({ name, code, email }: { name: string; code: string | null; email: string }) {
  return (
    <TableCell>
      <p className="font-medium text-fg">
        {name} <InvestorCode code={code} />
      </p>
      <p className="text-xs text-subtle">{email}</p>
    </TableCell>
  );
}

type ReviewInfoProps = {
  reviewedAt: Date | null;
  note: string | null;
  /** Receipt date of a reconciled deposit. */
  receivedOn?: string | null;
};

/** When and how a record was decided, shown under its status badge. */
async function ReviewInfo({ reviewedAt, note, receivedOn }: ReviewInfoProps) {
  const { messages, format } = await getI18n();
  return (
    <div className="mt-1 space-y-0.5 text-xs text-subtle">
      {reviewedAt ? <p className="whitespace-nowrap">{format.dateTime(reviewedAt)}</p> : null}
      {receivedOn ? (
        <p className="whitespace-nowrap">{messages.deposits.receivedOn(format.calendarDate(receivedOn))}</p>
      ) : null}
      {note ? <p className="max-w-56 text-muted">{note}</p> : null}
    </div>
  );
}

/** Gross amount with the fee-adjusted figure underneath: credited for deposits, debited for withdrawals. */
async function AmountCell({ amountCents, detail }: { amountCents: number; detail?: string }) {
  const { format } = await getI18n();
  return (
    <TableCell className="text-right whitespace-nowrap">
      <p className="amount font-medium text-fg">{format.currency(amountCents)}</p>
      {detail ? <p className="amount text-xs text-subtle">{detail}</p> : null}
    </TableCell>
  );
}

export async function DepositReviewTable({ deposits }: { deposits: DepositReviewRow[] }) {
  const { messages, format } = await getI18n();
  const columns = messages.columns;
  const reviewText = messages.admin.review;
  const today = todayIsoDate();

  if (deposits.length === 0) {
    return <EmptyState title={messages.admin.depositsEmpty} />;
  }
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>{columns.date}</TableHeaderCell>
          <TableHeaderCell>{columns.investor}</TableHeaderCell>
          <TableHeaderCell>{columns.reference}</TableHeaderCell>
          <TableHeaderCell className="text-right">{columns.amount}</TableHeaderCell>
          <TableHeaderCell>{columns.status}</TableHeaderCell>
          <TableHeaderCell>{columns.actions}</TableHeaderCell>
        </tr>
      </thead>
      <TableBody>
        {deposits.map((deposit) => {
          const bookedOn = formatIsoDate(deposit.createdAt);
          return (
            <tr key={deposit.id}>
              <TableCell className="whitespace-nowrap">{format.dateTime(deposit.createdAt)}</TableCell>
              <InvestorCell name={deposit.investorName} code={deposit.investorCode} email={deposit.investorEmail} />
              <TableCell className="whitespace-nowrap">
                <p className="reference text-xs text-muted">{deposit.reference}</p>
                <p className="text-xs text-subtle">{messages.paymentMethods[deposit.method]}</p>
                {deposit.promoName && deposit.promoTermMonths ? <p className="mt-1 text-xs font-medium text-accent-400">{deposit.promoName} · {messages.deposits.promoTermValue(deposit.promoTermMonths)}</p> : null}
              </TableCell>
              <AmountCell
                amountCents={deposit.amountCents}
                detail={
                  deposit.feeCents > 0
                    ? messages.deposits.credited(format.currency(deposit.amountCents - deposit.feeCents))
                    : undefined
                }
              />
              <TableCell>
                <DepositStatusBadge status={deposit.status} />
                <ReviewInfo reviewedAt={deposit.reviewedAt} note={deposit.reviewNote} receivedOn={deposit.receivedOn} />
              </TableCell>
              <TableCell>
                {deposit.status === "pending" ? (
                  <ReviewActions
                    approveAction={reconcileDepositAction.bind(null, deposit.id)}
                    rejectAction={rejectDepositAction.bind(null, deposit.id)}
                    approveLabel={reviewText.reconcile}
                    rejectLabel={reviewText.cancelDeposit}
                    receivedOn={{ defaultValue: bookedOn, min: bookedOn, max: today }}
                  />
                ) : (
                  messages.common.emptyValue
                )}
              </TableCell>
            </tr>
          );
        })}
      </TableBody>
    </Table>
  );
}

export async function WithdrawalReviewTable({ withdrawals }: { withdrawals: WithdrawalReviewRow[] }) {
  const { messages, format } = await getI18n();
  const columns = messages.columns;
  const reviewText = messages.admin.review;
  const today = todayIsoDate();

  if (withdrawals.length === 0) {
    return <EmptyState title={messages.admin.withdrawalsEmpty} />;
  }
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>{columns.date}</TableHeaderCell>
          <TableHeaderCell>{columns.investor}</TableHeaderCell>
          <TableHeaderCell>{columns.reference}</TableHeaderCell>
          <TableHeaderCell>{columns.destination}</TableHeaderCell>
          <TableHeaderCell className="text-right">{columns.amount}</TableHeaderCell>
          <TableHeaderCell>{columns.status}</TableHeaderCell>
          <TableHeaderCell>{columns.actions}</TableHeaderCell>
        </tr>
      </thead>
      <TableBody>
        {withdrawals.map((withdrawal) => {
          const dueOn = payoutDeadline(formatIsoDate(withdrawal.createdAt));
          const isOverdue = withdrawal.status === "pending" && dueOn < today;
          return (
            <tr key={withdrawal.id}>
              <TableCell className="whitespace-nowrap">
                <p>{format.dateTime(withdrawal.createdAt)}</p>
                {withdrawal.status === "pending" ? (
                  <p className={isOverdue ? "text-xs font-medium text-loss" : "text-xs text-subtle"}>
                    {columns.payoutDue(format.calendarDate(dueOn))}
                  </p>
                ) : null}
              </TableCell>
              <InvestorCell
                name={withdrawal.investorName}
                code={withdrawal.investorCode}
                email={withdrawal.investorEmail}
              />
              <TableCell className="reference text-xs whitespace-nowrap text-muted">{withdrawal.reference}</TableCell>
              <TableCell>
                <p className="text-xs text-subtle">{messages.paymentMethods[withdrawal.method]}</p>
                <p className={cn("reference max-w-56 text-xs", !withdrawal.iban && "break-all")}>
                  {formatPayoutDestination(withdrawal)}
                </p>
              </TableCell>
              <AmountCell
                amountCents={withdrawal.amountCents}
                detail={
                  withdrawal.feeCents > 0
                    ? messages.withdrawals.debited(format.currency(withdrawal.amountCents + withdrawal.feeCents))
                    : undefined
                }
              />
              <TableCell>
                <WithdrawalStatusBadge status={withdrawal.status} />
                <ReviewInfo reviewedAt={withdrawal.reviewedAt} note={withdrawal.reviewNote} />
              </TableCell>
              <TableCell>
                {withdrawal.status === "pending" ? (
                  <ReviewActions
                    approveAction={approveWithdrawalAction.bind(null, withdrawal.id)}
                    rejectAction={rejectWithdrawalAction.bind(null, withdrawal.id)}
                    approveLabel={reviewText.approve}
                    rejectLabel={reviewText.reject}
                  />
                ) : (
                  messages.common.emptyValue
                )}
              </TableCell>
            </tr>
          );
        })}
      </TableBody>
    </Table>
  );
}
