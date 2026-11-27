import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityLogTable } from "@/components/admin/activity-log-table";
import { StatementAmount, StatementClosingAmount, StatementMovements } from "@/components/admin/statement-cells";
import { StatementExport } from "@/components/admin/statement-export";
import { DepositHistory, WithdrawalHistory } from "@/components/transactions/request-history";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashAlert } from "@/components/ui/flash-alert";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n, pageMetadata } from "@/i18n/server";
import { monthOf, todayIsoDate } from "@/lib/calendar";
import { firstParam, parsePageParam } from "@/lib/pagination";
import { buildStatements, firstStatementMonth } from "@/lib/statements";
import { requireAdmin } from "@/server/auth/guards";
import { countAccountRequests, getInvestorDetail, listAuditLogs } from "@/server/queries/admin";
import { getAccountOverview, listRecentDeposits, listRecentWithdrawals } from "@/server/queries/investor";
import { listLedgerEntries } from "@/server/queries/ledger";
import { loadStatementData } from "@/server/queries/statements";

/** Deposits and withdrawals show the newest entries; the ledger and the activity log page through everything. */
const SECTION_LIMIT = 50;
/** Query parameter of the activity log's pager (the ledger's is `page`). */
const ACTIVITY_PAGE_PARAM = "activity";

export const generateMetadata = pageMetadata((messages) => messages.admin.investorsTitle);

/**
 * Everything about one investor for the admin: key figures, the monthly statement (investment on the 1st, return,
 * deposits and withdrawals), all requests, the ledger and the investor's own activity log. Editing lives on `/edit`.
 */
export default async function AdminInvestorViewPage({ params, searchParams }: PageProps<"/admin/investors/[userId]">) {
  await requireAdmin();
  const { userId } = await params;
  const [{ messages, format }, investor, query] = await Promise.all([
    getI18n(),
    getInvestorDetail(userId),
    searchParams,
  ]);
  if (!investor) {
    notFound();
  }
  const text = messages.admin.investorView;
  const today = todayIsoDate();
  const ledgerPage = parsePageParam(query.page);
  const activityPage = parsePageParam(query[ACTIVITY_PAGE_PARAM]);
  const [overview, statementData, deposits, withdrawals, requestCounts, ledger, activity] = await Promise.all([
    getAccountOverview(investor.id),
    loadStatementData([investor.accountId], today),
    listRecentDeposits(investor.id, SECTION_LIMIT),
    listRecentWithdrawals(investor.id, SECTION_LIMIT),
    countAccountRequests(investor.accountId),
    listLedgerEntries({ accountId: investor.accountId, page: ledgerPage }),
    // Only what the investor did; the admin's decisions show in the request tables and the pool-wide log.
    listAuditLogs({ actorUserId: investor.id, page: activityPage }),
  ]);
  const data = statementData.get(investor.accountId) ?? { entries: [], movements: [] };
  const firstMonth = firstStatementMonth(data.entries, data.movements);
  const statements = firstMonth ? buildStatements(data.entries, data.movements, firstMonth, monthOf(today)) : [];
  const justCreated = firstParam(query.created) === "1";
  const newestOf = (shown: number, total: number) => (total > shown ? text.newestOf(shown, total) : undefined);

  return (
    <>
      <Link href="/admin/investors" className="label-caps mb-3 inline-block text-accent-400 hover:underline">
        ← {messages.admin.investorDetail.backLink}
      </Link>
      <PageHeader
        title={investor.fullName}
        description={`${messages.columns.investorId} ${investor.investorCode} · ${investor.email}`}
        actions={
          <>
            {investor.deactivatedAt ? <Badge>{messages.investorStatus.deactivated}</Badge> : null}
            <Link href={`/admin/investors/${investor.id}/edit`} className={buttonStyles({ variant: "secondary" })}>
              <Icon name="pencil" className="size-4" />
              {messages.admin.investorActions.edit}
            </Link>
          </>
        }
      />
      {justCreated ? (
        <FlashAlert param="created" className="mb-4 lg:mb-6">
          {messages.admin.investorDetail.created}
        </FlashAlert>
      ) : null}

      <div className="flex flex-col gap-4 lg:gap-6">
        <section className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
          <StatCard label={messages.dashboard.balance} value={format.currency(overview.balanceCents)}>
            <p className="text-xs text-muted">
              {messages.columns.registeredAt}: {format.date(investor.createdAt)}
            </p>
          </StatCard>
          <StatCard label={messages.dashboard.available} value={format.currency(overview.availableCents)}>
            {overview.reservedCents > 0 ? (
              <p className="text-xs text-muted">
                {messages.dashboard.reservedPayouts(format.currency(overview.reservedCents))}
              </p>
            ) : null}
          </StatCard>
          <StatCard label={messages.dashboard.locked} value={format.currency(overview.lockedCents)}>
            {overview.pendingDepositCents > 0 ? (
              <p className="text-xs text-muted">
                {messages.dashboard.pendingDeposits(format.currency(overview.pendingDepositCents))}
              </p>
            ) : null}
          </StatCard>
          <StatCard label={text.totalReturns} value={format.signedCurrency(overview.totalReturnsCents)}>
            <p className="text-xs text-muted">
              {messages.columns.lastLoginAt}:{" "}
              {investor.lastLoginAt ? format.dateTime(investor.lastLoginAt) : messages.common.emptyValue}
            </p>
          </StatCard>
        </section>

        <Card className="min-w-0">
          <CardHeader
            title={text.statementTitle}
            description={text.statementSubtitle}
            icon="list"
            action={
              statements.length > 0 ? (
                <StatementExport
                  action={`/api/admin/investors/${investor.id}/statement`}
                  title={messages.admin.investorExport.titleOne(investor.fullName)}
                  description={messages.admin.investorExport.descriptionOne}
                  months={statements.map((statement) => statement.month)}
                  defaultFrom={statements[statements.length - 1].month}
                  defaultTo={statements[0].month}
                />
              ) : null
            }
          />
          {statements.length === 0 ? (
            <EmptyState title={text.statementEmpty} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>{messages.columns.month}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{text.investment}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{text.return}</TableHeaderCell>
                  <TableHeaderCell>{text.misc}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{messages.admin.investorMonth.closingBalance}</TableHeaderCell>
                </tr>
              </thead>
              <TableBody>
                {statements.map((statement) => (
                  <tr key={statement.month}>
                    <TableCell className="font-medium whitespace-nowrap text-fg">
                      {format.month(statement.month)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-fg">
                      <StatementAmount cents={statement.openingCents} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <StatementAmount cents={statement.returnCents} signed />
                    </TableCell>
                    <TableCell>
                      <StatementMovements
                        movements={statement.movements}
                        investorName={investor.fullName}
                        periodLabel={format.month(statement.month)}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <StatementClosingAmount statement={statement} />
                    </TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Full width each: the request tables have many columns and cut off amounts side by side. */}
        <div className="grid gap-4 lg:gap-6">
          <Card className="min-w-0">
            <CardHeader
              title={text.depositsTitle}
              description={newestOf(deposits.length, requestCounts.deposits)}
              icon="arrowDownLeft"
            />
            <DepositHistory deposits={deposits} emptyText={text.depositsEmpty} />
          </Card>
          <Card className="min-w-0">
            <CardHeader
              title={text.withdrawalsTitle}
              description={newestOf(withdrawals.length, requestCounts.withdrawals)}
              icon="arrowUpRight"
            />
            <WithdrawalHistory withdrawals={withdrawals} emptyText={text.withdrawalsEmpty} />
          </Card>
        </div>

        <Card id="ledger" className="min-w-0 scroll-mt-20">
          <CardHeader title={text.ledgerTitle} icon="receipt" />
          {ledger.rows.length === 0 ? (
            <EmptyState title={messages.transactions.empty} />
          ) : (
            <>
              <TransactionTable entries={ledger.rows} />
              <Pagination
                result={ledger}
                basePath={`/admin/investors/${investor.id}`}
                query={{ [ACTIVITY_PAGE_PARAM]: activityPage > 1 ? String(activityPage) : undefined }}
                fragment="ledger"
              />
            </>
          )}
        </Card>

        <Card id="activity" className="min-w-0 scroll-mt-20">
          <CardHeader title={text.activityTitle} description={text.activitySubtitle} icon="activity" />
          {activity.rows.length === 0 ? (
            <EmptyState title={text.activityEmpty} />
          ) : (
            <>
              <ActivityLogTable entries={activity.rows} showActor={false} />
              <Pagination
                result={activity}
                basePath={`/admin/investors/${investor.id}`}
                query={{ page: ledgerPage > 1 ? String(ledgerPage) : undefined }}
                param={ACTIVITY_PAGE_PARAM}
                fragment="activity"
              />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
