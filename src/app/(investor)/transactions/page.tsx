import Link from "next/link";
import { GroupFilter } from "@/components/transactions/group-filter";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/pagination";
import { segmentStyles } from "@/components/ui/segmented";
import { getI18n, pageMetadata } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { ENTRY_GROUPS, type EntryGroup } from "@/lib/ledger-groups";
import { firstParam, parseChoiceParam, parsePageParam } from "@/lib/pagination";
import { requireInvestor } from "@/server/auth/guards";
import { getAccountOverview } from "@/server/queries/investor";
import { countLedgerGroups, listLedgerEntries, type SortOrder } from "@/server/queries/ledger";

const SORT_ORDERS: readonly SortOrder[] = ["desc", "asc"];

export const generateMetadata = pageMetadata((messages) => messages.transactions.title);

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const user = await requireInvestor();
  const { messages, format } = await getI18n();
  const text = messages.transactions;
  const params = await searchParams;
  const order = parseChoiceParam(params.order, SORT_ORDERS, "desc");
  const groupParam = firstParam(params.group);
  const group: EntryGroup | undefined = ENTRY_GROUPS.find((candidate) => candidate === groupParam);
  const page = parsePageParam(params.page);

  const overview = await getAccountOverview(user.id);
  const [ledger, counts] = await Promise.all([
    listLedgerEntries({ accountId: overview.accountId, group, page, order }),
    countLedgerGroups(overview.accountId),
  ]);
  const orderQuery = order === "asc" ? "asc" : undefined;
  const sortLinks = [
    { order: "desc", label: text.sortNewest },
    { order: "asc", label: text.sortOldest },
  ] as const;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <section className="ambient-glow flex flex-col gap-4 rounded-xl bg-raised p-4 shadow-xl sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="label-caps flex items-center gap-1.5 text-muted">
            <Icon name="shieldCheck" className="size-[18px] text-accent-400" />
            {text.title}
          </h1>
          <span className="label-caps text-subtle">{text.entriesTotal(counts.all)}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps text-muted">{text.runningBalance}</p>
            <p className="mt-1 font-display text-[32px] leading-10 font-bold tracking-tight text-fg">
              {format.currency(overview.balanceCents)}
            </p>
            <p className="mt-1 max-w-xl text-[13px] text-muted">{text.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-well p-1">
            {sortLinks.map((sortLink) => {
              const href = new URLSearchParams();
              if (sortLink.order === "asc") {
                href.set("order", "asc");
              }
              if (group) {
                href.set("group", group);
              }
              const query = href.toString();
              return (
                <Link
                  key={sortLink.order}
                  href={query ? `/transactions?${query}` : "/transactions"}
                  aria-current={order === sortLink.order ? "true" : undefined}
                  className={cn(segmentStyles(order === sortLink.order), "rounded-md text-center")}
                >
                  {sortLink.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <GroupFilter counts={counts} active={group} basePath="/transactions" query={{ order: orderQuery }} />

      <Card>
        {ledger.rows.length === 0 ? (
          <EmptyState title={text.empty} />
        ) : (
          <>
            <div className="pt-3 xl:pt-0">
              <TransactionTable entries={ledger.rows} />
            </div>
            <Pagination result={ledger} basePath="/transactions" query={{ order: orderQuery, group }} />
          </>
        )}
      </Card>

      <section className="flex gap-3 rounded-xl border border-line bg-surface p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-400/10 text-accent-400">
          <Icon name="lock" className="size-[18px]" />
        </span>
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-fg">
            {text.immutableTitle}
            <Icon name="shieldCheck" className="size-4 text-accent-400" />
          </h2>
          <p className="mt-1 text-[13px] text-muted">{text.immutableText}</p>
        </div>
      </section>
    </div>
  );
}
