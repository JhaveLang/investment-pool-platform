import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { AvailabilityDonut } from "@/components/dashboard/availability-donut";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { Meter } from "@/components/dashboard/meter";
import { MoveMoneyPreview } from "@/components/dashboard/move-money-preview";
import { OpenRequests } from "@/components/dashboard/open-requests";
import { WelcomeDialog } from "@/components/dashboard/welcome-dialog";
import { GroupFilter } from "@/components/transactions/group-filter";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardHeader, CardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { DeltaChip, StatCard } from "@/components/ui/stat-card";
import { getI18n, pageMetadata } from "@/i18n/server";
import { addDays, todayIsoDate } from "@/lib/calendar";
import { formatIsoDate } from "@/lib/format";
import { WELCOME_PARAM } from "@/lib/onboarding";
import { firstParam } from "@/lib/pagination";
import { MINIMUM_TERM_DAYS, minimumTermEnd, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";
import { requireInvestor } from "@/server/auth/guards";
import { getLatestReturnRate, listMonthlyReturns, loadBalanceHistory } from "@/server/queries/charts";
import { getAccountOverview, listRecentDeposits, listRecentWithdrawals } from "@/server/queries/investor";
import { countLedgerGroups, listLedgerEntries } from "@/server/queries/ledger";

const RECENT_ENTRY_COUNT = 6;

export const generateMetadata = pageMetadata((messages) => messages.dashboard.title);

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireInvestor();
  const { messages, format } = await getI18n();
  const text = messages.dashboard;
  const overview = await getAccountOverview(user.id);
  const [recentEntries, groupCounts, history, monthlyReturns, latestRate, recentDeposits, recentWithdrawals] =
    await Promise.all([
      listLedgerEntries({ accountId: overview.accountId, page: 1, pageSize: RECENT_ENTRY_COUNT }),
      countLedgerGroups(overview.accountId),
      loadBalanceHistory(overview.accountId),
      listMonthlyReturns(overview.accountId),
      getLatestReturnRate(),
      listRecentDeposits(user.id),
      listRecentWithdrawals(user.id),
    ]);
  // The welcome popup after signing up: only while no deposit has been started, so it never shows twice by mistake.
  const showWelcome = firstParam((await searchParams)[WELCOME_PARAM]) === "1" && recentDeposits.length === 0;
  const renderedAt = new Date();
  const today = todayIsoDate();

  // Balance trend from zero the day before the first movement up to today.
  const trend =
    history.length === 0
      ? []
      : [
          { day: addDays(history[0].day, -1), cents: 0 },
          ...history.map((point) => ({ day: point.day, cents: point.balanceCents })),
          { day: today, cents: overview.balanceCents },
        ];
  const latestReturn = monthlyReturns.at(-1);
  const balanceShare = (cents: number) => (overview.balanceCents > 0 ? cents / overview.balanceCents : 0);
  // Credited amount that leaves the minimum term on the next release day.
  const nextUnlockCents = overview.nextUnlockOn
    ? recentDeposits
        .filter(
          (deposit) =>
            deposit.status !== "rejected" &&
            minimumTermEnd(deposit.receivedOn ?? formatIsoDate(deposit.createdAt)) === overview.nextUnlockOn,
        )
        .reduce((sum, deposit) => sum + deposit.amountCents - deposit.feeCents, 0)
    : 0;

  return (
    <>
      <AutoRefresh />
      {showWelcome ? <WelcomeDialog name={user.fullName} balanceCents={overview.balanceCents} /> : null}
      <h1 className="sr-only lg:hidden">{text.greeting(user.fullName)}</h1>

      {/* Desktop header strip */}
      <section className="mb-6 hidden flex-wrap items-center justify-between gap-4 rounded-xl bg-surface p-4 lg:flex">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-raised text-accent-400 shadow-inner">
              <Icon name="bank" className="size-6" />
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold tracking-tight text-fg">
                {text.greeting(user.fullName)}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="label-caps">{text.accountLabel}</span>
                <span aria-hidden className="text-highest">
                  •
                </span>
                <span>{text.asOf(format.dateTime(renderedAt))}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-l border-overlay pl-4">
            {latestRate ? (
              <span className="flex items-center gap-1.5 rounded-full bg-accent-400/10 px-2.5 py-1 text-accent-400">
                <span aria-hidden className="size-1.5 rounded-full bg-accent-400 motion-safe:animate-pulse" />
                <span className="label-caps">
                  {text.poolResultPill(format.month(latestRate.month), format.rate(latestRate.ratePpm))}
                </span>
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-muted">
              <Icon name="lock" className="size-3.5 text-warn" />
              <span className="label-caps">{text.minimumTermPill(MINIMUM_TERM_DAYS)}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/transactions" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            <Icon name="list" className="size-4" />
            {messages.nav.transactions}
          </Link>
          <Link href="/withdraw" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <Icon name="arrowUpRight" className="size-4" />
            {text.withdrawCta}
          </Link>
          <Link href="/deposit" className={buttonStyles({ size: "sm" })}>
            <Icon name="plusCircle" className="size-[18px]" />
            {text.depositCta}
          </Link>
        </div>
      </section>

      {/* Key figures; on phones only the balance hero */}
      <section className="mb-4 grid gap-4 lg:mb-6 lg:grid-cols-2 xl:grid-cols-4">
        <BalanceHero overview={overview} trend={trend} latestRate={latestRate} />
        <StatCard
          className="hidden lg:flex"
          label={text.available}
          value={format.currency(overview.availableCents)}
          aside={
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-raised text-accent-400">
              <Icon name="wallet" className="size-4" />
            </span>
          }
        >
          <div className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-accent-400">{text.payoutWithin(PAYOUT_DEADLINE_DAYS)}</span>
            <Meter value={balanceShare(overview.availableCents)} />
            <span className="text-subtle">
              {text.shareOfBalance(format.percent(Math.round(balanceShare(overview.availableCents) * 100)))}
            </span>
          </div>
        </StatCard>
        <StatCard
          className="hidden lg:flex"
          label={text.locked}
          value={format.currency(overview.lockedCents)}
          aside={<DeltaChip value={text.daysChip(MINIMUM_TERM_DAYS)} />}
        >
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between gap-2 text-muted">
              <span>{text.nextUnlock}</span>
              <span className="font-semibold text-fg">
                {overview.nextUnlockOn ? format.calendarDate(overview.nextUnlockOn) : text.nothingLocked}
              </span>
            </div>
            <Meter value={balanceShare(overview.lockedCents)} className="bg-indigo" />
            <span className="text-subtle">
              {nextUnlockCents > 0
                ? text.unlocksAmount(format.currency(nextUnlockCents))
                : text.shareOfBalance(format.percent(Math.round(balanceShare(overview.lockedCents) * 100)))}
            </span>
          </div>
        </StatCard>
        <StatCard
          className="hidden lg:flex"
          label={latestReturn ? text.returnFor(format.month(latestReturn.month)) : text.returnsTitle}
          value={latestReturn ? format.signedCurrency(latestReturn.amountCents) : format.currency(0)}
          aside={
            latestRate ? (
              <DeltaChip value={format.rate(latestRate.ratePpm)} negative={latestRate.ratePpm < 0} />
            ) : undefined
          }
        >
          <div className="flex items-end justify-between gap-3 text-xs">
            <div>
              <p className="label-caps text-muted">{text.sumReturns}</p>
              <p className="amount text-[13px] font-semibold text-accent-400">
                {format.signedCurrency(overview.totalReturnsCents)}
              </p>
            </div>
            <div className="text-right">
              <p className="label-caps text-muted">{text.bookedMonths}</p>
              <p className="text-[13px] font-semibold text-fg">{monthlyReturns.length}</p>
            </div>
          </div>
        </StatCard>
      </section>

      {/* Phone: live strip and pool card */}
      <div className="mb-4 flex flex-col gap-4 lg:hidden">
        <div className="flex items-center justify-between rounded-lg bg-surface px-4 py-2">
          <span className="label-caps flex items-center gap-2 text-fg">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-accent-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-accent-400" />
            </span>
            {text.liveBalance}
          </span>
          <span className="text-xs text-muted">{text.asOf(format.time(renderedAt))}</span>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-raised p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps text-accent-400">{text.poolCardEyebrow}</p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-fg">{messages.app.name}</h2>
            </div>
            <span className="grid size-9 place-items-center rounded-lg bg-overlay text-accent-400">
              <Icon name="bank" className="size-5" />
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-well px-3 py-2.5">
            <div>
              <dt className="label-caps text-muted">{text.poolResult}</dt>
              <dd className="mt-0.5 text-[13px] font-bold text-fg">
                {latestRate ? format.rate(latestRate.ratePpm) : messages.common.emptyValue}
              </dd>
            </div>
            <div>
              <dt className="label-caps text-muted">{text.yourReturn}</dt>
              <dd className="amount mt-0.5 text-[13px] font-bold text-accent-400">
                {latestReturn ? format.signedCurrency(latestReturn.amountCents) : messages.common.emptyValue}
              </dd>
            </div>
            <div>
              <dt className="label-caps text-muted">{text.monthsShort}</dt>
              <dd className="mt-0.5 text-[13px] font-bold text-fg">{monthlyReturns.length}</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-overlay/60 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-surface text-accent-400">
                <Icon name="clock" className="size-[18px]" />
              </span>
              <div>
                <p className="label-caps text-muted">{text.nextUnlock}</p>
                <p className="text-sm font-semibold text-fg">
                  {overview.nextUnlockOn ? format.calendarDate(overview.nextUnlockOn) : text.nothingLocked}
                </p>
              </div>
            </div>
            {nextUnlockCents > 0 ? (
              <div className="text-right">
                <p className="label-caps text-muted">{text.unlockAmount}</p>
                <p className="amount text-sm font-semibold text-accent-400">{format.currency(nextUnlockCents)}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:gap-6 wide:grid-cols-12 wide:items-start">
        <Card className="min-w-0 wide:col-span-8">
          <CardHeader
            title={text.ledgerTitle}
            description={text.ledgerSubtitle}
            icon="receipt"
            action={recentEntries.totalCount > 0 ? <CardLink href="/transactions">{text.viewAll}</CardLink> : undefined}
          />
          {recentEntries.rows.length === 0 ? (
            <EmptyState
              title={text.emptyTitle}
              description={text.emptyDescription}
              action={
                <Link href="/deposit" className={buttonStyles()}>
                  {text.depositCta}
                </Link>
              }
            />
          ) : (
            <>
              <GroupFilter counts={groupCounts} basePath="/transactions" className="px-5 pb-4" />
              <TransactionTable entries={recentEntries.rows} />
              <p className="border-t border-line px-5 py-3.5 text-[13px] text-muted">
                {messages.common.showingRange(1, recentEntries.rows.length, recentEntries.totalCount)}
              </p>
            </>
          )}
        </Card>

        <aside className="grid min-w-0 content-start gap-4 lg:grid-cols-2 lg:gap-6 wide:col-span-4 wide:grid-cols-1">
          <div className="hidden lg:block">
            <MoveMoneyPreview availableCents={overview.availableCents} />
          </div>
          <OpenRequests deposits={recentDeposits} withdrawals={recentWithdrawals} />
          <div className="hidden lg:block">
            <AvailabilityDonut overview={overview} />
          </div>
        </aside>
      </div>
    </>
  );
}
