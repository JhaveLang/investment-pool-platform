import Link from "next/link";
import { ApprovalQueue } from "@/components/admin/approval-queue";
import { AutoRefresh } from "@/components/auto-refresh";
import { Sparkline } from "@/components/charts/sparkline";
import { PayoutDeadlines } from "@/components/dashboard/payout-deadlines";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { DeltaChip, StatCard } from "@/components/ui/stat-card";
import { getI18n, pageMetadata } from "@/i18n/server";
import { addDays, todayIsoDate } from "@/lib/calendar";
import { requireAdmin } from "@/server/auth/guards";
import {
  getLedgerIntegrity,
  getNetMovementSince,
  getPoolOverview,
  listDepositsForReview,
  listWithdrawalsForReview,
} from "@/server/queries/admin";
import { getLatestReturnRate, loadBalanceHistory } from "@/server/queries/charts";
import { listLedgerEntries } from "@/server/queries/ledger";
import { getReturnSchedule } from "@/server/queries/returns";

const LATEST_ENTRY_COUNT = 6;
const QUEUE_SIZE = 4;
const MOVEMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const generateMetadata = pageMetadata((messages) => messages.admin.overviewTitle);

type UtilityLinkProps = { href: string; icon: IconName; title: string; detail: string; download?: boolean };

function UtilityLink({ href, icon, title, detail, download = false }: UtilityLinkProps) {
  const className = "flex items-center gap-3 rounded-lg bg-raised p-3 transition-colors hover:bg-overlay";
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-400/10 text-accent-400">
        <Icon name={icon} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
      <Icon name={download ? "download" : "chevronRight"} className="size-4 shrink-0 text-subtle" />
    </>
  );
  // A plain anchor for the CSV route: `Link` would prefetch it, running (and audit-logging) an export on every view.
  return download ? (
    <a href={href} download className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const { messages, format } = await getI18n();
  const text = messages.admin;
  const renderedAt = new Date();
  const [overview, latestEntries, returnSchedule, history, latestRate, withdrawals, deposits, movement, integrity] =
    await Promise.all([
      getPoolOverview(),
      listLedgerEntries({ page: 1, pageSize: LATEST_ENTRY_COUNT }),
      getReturnSchedule(),
      loadBalanceHistory(),
      getLatestReturnRate(),
      listWithdrawalsForReview({ status: "pending", page: 1, pageSize: QUEUE_SIZE }),
      listDepositsForReview({ status: "pending", page: 1, pageSize: QUEUE_SIZE }),
      getNetMovementSince(new Date(renderedAt.getTime() - MOVEMENT_WINDOW_MS)),
      getLedgerIntegrity(),
    ]);
  // The next month in order, or before the very first booking the latest ended month.
  const unbookedMonth = returnSchedule.bookableMonths[0];
  const openCount = overview.pendingWithdrawals.count + overview.pendingDeposits.count;
  const openTotalCents = overview.pendingWithdrawals.totalCents + overview.pendingDeposits.totalCents;
  const trend =
    history.length === 0
      ? []
      : [
          { day: addDays(history[0].day, -1), cents: 0 },
          ...history.map((point) => ({ day: point.day, cents: point.balanceCents })),
          { day: todayIsoDate(), cents: overview.poolBalanceCents },
        ];

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <AutoRefresh />
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-accent-400/25 bg-accent-400/10 px-2.5 py-1 text-accent-400">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-400 motion-safe:animate-pulse" />
            <span className="label-caps">{messages.nav.consoleAdmin}</span>
          </span>
          <span className="label-caps text-subtle">{messages.dashboard.asOf(format.time(renderedAt))}</span>
        </div>
        <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight text-fg sm:text-[32px] sm:leading-10">
          {text.overviewTitle}
        </h1>
        <p className="max-w-2xl text-sm text-muted">{text.overviewSubtitle}</p>
      </header>

      {unbookedMonth ? (
        <Alert tone="info">
          {text.returnsReminder(format.month(unbookedMonth))}{" "}
          <Link href="/admin/returns" className="font-semibold text-accent-400 hover:text-accent-300">
            {text.returnsReminderLink}
          </Link>
        </Alert>
      ) : null}

      <section className="@container grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <StatCard
          label={text.poolVolume}
          value={format.currency(overview.poolBalanceCents)}
          aside={
            latestRate ? (
              <DeltaChip value={format.rate(latestRate.ratePpm)} negative={latestRate.ratePpm < 0} />
            ) : undefined
          }
        >
          <Sparkline id="pool-volume" values={trend} className="h-9 w-full" />
        </StatCard>
        <StatCard label={text.netMovement} value={format.signedCurrency(movement.netCents)}>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name="activity" className="size-3.5 text-accent-400" />
            {text.entriesInWindow(movement.entryCount)}
          </p>
        </StatCard>
        <StatCard label={text.pendingWithdrawals} value={String(overview.pendingWithdrawals.count)}>
          <p className="amount text-xs text-muted">{format.currency(overview.pendingWithdrawals.totalCents)}</p>
        </StatCard>
        <StatCard label={text.unreconciledDeposits} value={String(overview.pendingDeposits.count)}>
          <p className="amount text-xs text-muted">{format.currency(overview.pendingDeposits.totalCents)}</p>
        </StatCard>
      </section>

      <div className="grid gap-4 lg:gap-6 wide:grid-cols-12 wide:items-start">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6 wide:col-span-8">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-fg">
                {text.queueTitle}
                {openCount > 0 ? <Badge tone="warning">{openCount}</Badge> : null}
              </h2>
              {openCount > 0 ? (
                <span className="amount text-[13px] text-muted">
                  {text.queueTotal(format.currency(openTotalCents))}
                </span>
              ) : null}
            </div>
            <ApprovalQueue withdrawals={withdrawals.rows} deposits={deposits.rows} />
          </section>

          <Card className="min-w-0">
            <CardHeader title={text.latestEntries} icon="receipt" />
            {latestEntries.rows.length === 0 ? (
              <EmptyState title={messages.transactions.empty} />
            ) : (
              <TransactionTable entries={latestEntries.rows} showInvestor />
            )}
          </Card>
        </div>

        <aside className="grid min-w-0 content-start gap-4 lg:grid-cols-2 lg:gap-6 wide:col-span-4 wide:grid-cols-1">
          <Card>
            <CardHeader title={text.utilitiesTitle} icon="file" />
            <div className="flex flex-col gap-2 px-3 pb-3">
              <UtilityLink
                href="/api/reports/transactions"
                download
                icon="download"
                title={text.exportJournal}
                detail={text.exportJournalDetail}
              />
              <UtilityLink
                href="/admin/returns"
                icon="trendingUp"
                title={text.returnsTitle}
                detail={
                  returnSchedule.lastBookedMonth
                    ? text.lastBooked(format.month(returnSchedule.lastBookedMonth))
                    : text.returnsHistoryEmpty
                }
              />
              <UtilityLink
                href="/admin/investors"
                icon="users"
                title={text.investorsTitle}
                detail={text.investorTotal(overview.investorCount)}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title={text.integrityTitle}
              icon="shieldCheck"
              action={
                <Badge tone={integrity.mismatchedAccounts === 0 ? "success" : "danger"}>
                  {integrity.mismatchedAccounts === 0 ? text.integrityOk : text.integrityFailed}
                </Badge>
              }
            />
            <dl className="flex flex-col gap-3 px-5 pb-5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-fg">
                  <Icon name="list" className="size-4 text-accent-400" />
                  {text.balancesMatchLedger}
                </dt>
                <dd
                  className={
                    integrity.mismatchedAccounts === 0 ? "font-semibold text-accent-400" : "font-semibold text-loss"
                  }
                >
                  {integrity.mismatchedAccounts === 0
                    ? text.allAccountsMatch
                    : text.mismatchCount(integrity.mismatchedAccounts)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-fg">
                  <Icon name="wallet" className="size-4 text-subtle" />
                  {text.zeroBalanceAccounts}
                </dt>
                <dd className="font-semibold text-fg">{integrity.zeroBalanceAccounts}</dd>
              </div>
              <p className="rounded-lg bg-raised p-3 text-xs text-muted">{text.integrityNote}</p>
            </dl>
          </Card>

          <PayoutDeadlines withdrawals={withdrawals.rows} />
        </aside>
      </div>
    </div>
  );
}
