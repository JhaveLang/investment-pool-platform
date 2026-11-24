import { InvestorCode } from "@/components/admin/investor-code";
import { EntryStatusBadge } from "@/components/status-badges";
import { SignedAmount } from "@/components/ui/amount";
import { Icon, type IconName } from "@/components/ui/icon";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import type { LedgerEntryType } from "@/server/db/schema";
import type { LedgerRow } from "@/server/queries/ledger";

const entryIcons: Record<LedgerEntryType, { icon: IconName; tile: string }> = {
  deposit: { icon: "arrowDownLeft", tile: "bg-gain/10 text-gain" },
  withdrawal: { icon: "arrowUpRight", tile: "bg-overlay text-muted" },
  deposit_reversal: { icon: "undo", tile: "bg-loss/10 text-loss" },
  withdrawal_reversal: { icon: "undo", tile: "bg-overlay text-muted" },
  deposit_fee: { icon: "receipt", tile: "bg-overlay text-subtle" },
  withdrawal_fee: { icon: "receipt", tile: "bg-overlay text-subtle" },
  monthly_return: { icon: "trendingUp", tile: "bg-warn/10 text-warn" },
};

function EntryIcon({ entry, className }: { entry: LedgerRow; className?: string }) {
  const { icon, tile } = entryIcons[entry.entryType];
  const isLossMonth = entry.entryType === "monthly_return" && entry.amountCents < 0;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg",
        isLossMonth ? "bg-loss/10 text-loss" : tile,
        className,
      )}
    >
      <Icon name={isLossMonth ? "trendingDown" : icon} className="size-[18px]" />
    </span>
  );
}

function ReferenceChip({ reference }: { reference: string }) {
  return (
    <span className="reference inline-flex rounded-md bg-accent-400/5 px-2 py-1 text-xs font-medium whitespace-nowrap text-accent-400">
      {reference}
    </span>
  );
}

type TransactionTableProps = {
  entries: LedgerRow[];
  /** Adds the investor to each entry, for the pool-wide admin view. */
  showInvestor?: boolean;
};

/** Ledger entries as cards on phones and tablets, and as a table from the `xl` breakpoint. */
export async function TransactionTable({ entries, showInvestor = false }: TransactionTableProps) {
  const { messages, format } = await getI18n();
  const text = messages.transactions;
  const detailOf = (entry: LedgerRow) =>
    showInvestor ? (
      <>
        {entry.investorName} <InvestorCode code={entry.investorCode} />
      </>
    ) : entry.method ? (
      messages.paymentMethods[entry.method]
    ) : (
      text.poolBooking
    );

  return (
    <>
      <ul className="flex flex-col gap-2 px-3 pb-3 xl:hidden">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-3 rounded-xl bg-raised p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <EntryIcon entry={entry} className="size-10" />
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] leading-tight font-semibold text-fg">
                    {messages.entryTypes[entry.entryType]}
                  </p>
                  <p className="truncate text-xs text-muted">{detailOf(entry)}</p>
                  <p className="mt-0.5 text-xs text-subtle">{format.dateTime(entry.createdAt)}</p>
                  <div className="mt-1.5">
                    <EntryStatusBadge entry={entry} />
                  </div>
                  {entry.reference ? (
                    <p className="label-caps mt-1 truncate text-subtle">
                      {text.referenceShort}: <span className="reference text-accent-400">{entry.reference}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <SignedAmount cents={entry.amountCents} className="shrink-0 font-display text-[15px] font-bold" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface/60 px-3 py-2">
              <span className="label-caps flex items-center gap-1.5 text-subtle">
                <Icon name="bank" className="size-3.5" />
                {text.balanceAfter}
              </span>
              <span className="amount text-[13px] font-semibold text-fg">
                {format.currency(entry.balanceAfterCents)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden xl:block">
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>{text.typeAndDetails}</TableHeaderCell>
              <TableHeaderCell>{text.date}</TableHeaderCell>
              <TableHeaderCell className="hidden 2xl:table-cell">{text.reference}</TableHeaderCell>
              <TableHeaderCell className="text-right">{text.amount}</TableHeaderCell>
              <TableHeaderCell className="text-right">{text.balanceAfter}</TableHeaderCell>
            </tr>
          </thead>
          <TableBody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <EntryIcon entry={entry} className="size-9" />
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{messages.entryTypes[entry.entryType]}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span>{detailOf(entry)}</span>
                        {/* Below 2xl the reference joins the details instead of taking its own column. */}
                        {entry.reference ? (
                          <span className="reference text-accent-400 2xl:hidden">{entry.reference}</span>
                        ) : null}
                        <EntryStatusBadge entry={entry} />
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <p className="text-fg">{format.date(entry.createdAt)}</p>
                  <p className="amount text-xs text-subtle">{format.time(entry.createdAt)}</p>
                </TableCell>
                <TableCell className="hidden 2xl:table-cell">
                  {entry.reference ? <ReferenceChip reference={entry.reference} /> : messages.common.emptyValue}
                </TableCell>
                <TableCell className="text-right">
                  <SignedAmount cents={entry.amountCents} />
                </TableCell>
                <TableCell className="amount text-right font-semibold text-fg">
                  {format.currency(entry.balanceAfterCents)}
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
