import { DepositStatusBadge, WithdrawalStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { formatPayoutDestination } from "@/lib/iban";
import type { RecentDeposit, RecentWithdrawal } from "@/server/queries/investor";

const cardStyles = "flex items-start justify-between gap-3 rounded-xl bg-raised p-3";

/** `emptyText` replaces the investor's own wording when the admin looks at the history. */
export async function DepositHistory({ deposits, emptyText }: { deposits: RecentDeposit[]; emptyText?: string }) {
  const { messages, format } = await getI18n();
  const columns = messages.columns;
  const text = messages.deposits;

  if (deposits.length === 0) {
    return <EmptyState title={emptyText ?? text.empty} />;
  }
  return (
    <>
      <ul className="flex flex-col gap-2 px-3 pb-3 md:hidden">
        {deposits.map((deposit) => (
          <li key={deposit.id} className={cardStyles}>
            <div className="flex min-w-0 gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-400/10 text-accent-400">
                <Icon name="arrowDownLeft" className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{messages.paymentMethods[deposit.method]}</p>
                <p className="text-xs text-muted">{format.dateTime(deposit.createdAt)}</p>
                <p className="reference truncate text-xs text-accent-400">{deposit.reference}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="amount text-sm font-bold text-accent-400">
                {format.signedCurrency(deposit.amountCents)}
              </span>
              {deposit.feeCents > 0 ? (
                <span className="amount text-xs text-subtle">
                  {text.credited(format.currency(deposit.amountCents - deposit.feeCents))}
                </span>
              ) : null}
              <DepositStatusBadge status={deposit.status} />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>{columns.date}</TableHeaderCell>
              <TableHeaderCell>{columns.reference}</TableHeaderCell>
              <TableHeaderCell>{columns.method}</TableHeaderCell>
              <TableHeaderCell className="text-right">{columns.amount}</TableHeaderCell>
              <TableHeaderCell>{columns.status}</TableHeaderCell>
            </tr>
          </thead>
          <TableBody>
            {deposits.map((deposit) => (
              <tr key={deposit.id}>
                <TableCell className="whitespace-nowrap">{format.dateTime(deposit.createdAt)}</TableCell>
                <TableCell className="reference text-xs whitespace-nowrap text-accent-400">
                  {deposit.reference}
                </TableCell>
                <TableCell className="whitespace-nowrap">{messages.paymentMethods[deposit.method]}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <p className="amount font-semibold text-fg">{format.currency(deposit.amountCents)}</p>
                  {deposit.feeCents > 0 ? (
                    <p className="amount text-xs text-subtle">
                      {text.credited(format.currency(deposit.amountCents - deposit.feeCents))}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <DepositStatusBadge status={deposit.status} />
                  {deposit.receivedOn ? (
                    <p className="mt-1 text-xs whitespace-nowrap text-subtle">
                      {text.receivedOn(format.calendarDate(deposit.receivedOn))}
                    </p>
                  ) : null}
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export async function WithdrawalHistory({
  withdrawals,
  emptyText,
}: {
  withdrawals: RecentWithdrawal[];
  emptyText?: string;
}) {
  const { messages, format } = await getI18n();
  const columns = messages.columns;
  const text = messages.withdrawals;

  if (withdrawals.length === 0) {
    return <EmptyState title={emptyText ?? text.empty} />;
  }
  return (
    <>
      <ul className="flex flex-col gap-2 px-3 pb-3 md:hidden">
        {withdrawals.map((withdrawal) => (
          <li key={withdrawal.id} className={cardStyles}>
            <div className="flex min-w-0 gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-overlay text-muted">
                <Icon name="arrowUpRight" className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{messages.paymentMethods[withdrawal.method]}</p>
                <p className="text-xs text-muted">{format.dateTime(withdrawal.createdAt)}</p>
                <p className={cn("reference text-xs text-subtle", withdrawal.iban ? "truncate" : "break-all")}>
                  {formatPayoutDestination(withdrawal)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="amount text-sm font-bold text-loss">
                {format.signedCurrency(-withdrawal.amountCents)}
              </span>
              {withdrawal.feeCents > 0 ? (
                <span className="amount text-xs text-subtle">
                  {text.debited(format.currency(withdrawal.amountCents + withdrawal.feeCents))}
                </span>
              ) : null}
              <WithdrawalStatusBadge status={withdrawal.status} />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>{columns.date}</TableHeaderCell>
              <TableHeaderCell>{columns.reference}</TableHeaderCell>
              <TableHeaderCell>{columns.destination}</TableHeaderCell>
              <TableHeaderCell className="text-right">{columns.amount}</TableHeaderCell>
              <TableHeaderCell>{columns.status}</TableHeaderCell>
            </tr>
          </thead>
          <TableBody>
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <TableCell className="whitespace-nowrap">{format.dateTime(withdrawal.createdAt)}</TableCell>
                <TableCell className="reference text-xs whitespace-nowrap text-accent-400">
                  {withdrawal.reference}
                </TableCell>
                <TableCell>
                  <p className="text-xs text-subtle">{messages.paymentMethods[withdrawal.method]}</p>
                  <p className={cn("reference max-w-48 text-xs", !withdrawal.iban && "break-all")}>
                    {formatPayoutDestination(withdrawal)}
                  </p>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <p className="amount font-semibold text-fg">{format.currency(withdrawal.amountCents)}</p>
                  {withdrawal.feeCents > 0 ? (
                    <p className="amount text-xs text-subtle">
                      {text.debited(format.currency(withdrawal.amountCents + withdrawal.feeCents))}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <WithdrawalStatusBadge status={withdrawal.status} />
                  {withdrawal.reviewNote ? (
                    <p className="mt-1 max-w-48 text-xs text-subtle">{withdrawal.reviewNote}</p>
                  ) : null}
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
