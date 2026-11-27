import Link from "next/link";
import { InvestorCodeEditor, InvestorCodeSaveBar } from "@/components/admin/investor-code-editor";
import { InvestorTable } from "@/components/admin/investor-table";
import { StatementExport } from "@/components/admin/statement-export";
import { StatusFilter } from "@/components/admin/status-filter";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputStyles } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getI18n, pageMetadata } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { addDays, addMonths, todayIsoDate, type IsoMonth } from "@/lib/calendar";
import { firstParam, parseChoiceParam, parsePageParam } from "@/lib/pagination";
import { directoryStatementMonths } from "@/lib/statement-period";
import { buildPeriodStatement, type StatementFigures } from "@/lib/statements";
import { requireAdmin } from "@/server/auth/guards";
import { INVESTOR_LIST_FILTERS, listInvestors } from "@/server/queries/admin";
import { getFirstDepositMonth, loadStatementData } from "@/server/queries/statements";

const MAX_SEARCH_LENGTH = 100;
const CSV_MONTH_CHOICES = 24;

export const generateMetadata = pageMetadata((messages) => messages.admin.investorsTitle);

/** Available months for CSV exports, newest first. */
function monthChoices(currentMonth: IsoMonth, firstMonth: IsoMonth | null): IsoMonth[] {
  const choices: IsoMonth[] = [];
  const oldest = firstMonth && firstMonth < currentMonth ? firstMonth : currentMonth;
  for (let month = currentMonth; month >= oldest && choices.length < CSV_MONTH_CHOICES; month = addMonths(month, -1)) {
    choices.push(month);
  }
  return choices;
}

export default async function AdminInvestorsPage({ searchParams }: PageProps<"/admin/investors">) {
  await requireAdmin();
  const { messages, format } = await getI18n();
  const text = messages.admin;
  const params = await searchParams;
  const search = firstParam(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  // Every investor unless a status is chosen.
  const explicitStatus = firstParam(params.status);
  const status = parseChoiceParam(explicitStatus, INVESTOR_LIST_FILTERS, "all");
  const { months, currentMonth, period } = directoryStatementMonths(todayIsoDate(), firstParam(params.month));
  const month = period.value;
  const monthQuery = month === currentMonth ? undefined : month;
  const upcoming = month > currentMonth;
  const [result, firstMonth] = await Promise.all([
    listInvestors({ status, search, page: parsePageParam(params.page) }),
    getFirstDepositMonth(),
  ]);
  const statements: Record<string, StatementFigures> = {};
  if (!upcoming) {
    // Month-end returns have a ledger value date on the following day.
    const data = await loadStatementData(result.rows.map((row) => row.accountId), addDays(period.to, 1));
    for (const [accountId, account] of data) {
      statements[accountId] = buildPeriodStatement(account.entries, account.movements, period);
    }
  }
  const exportTo = upcoming ? currentMonth : month;
  const choices = monthChoices(currentMonth, firstMonth && firstMonth < exportTo ? firstMonth : exportTo);
  const oldestChoice = choices[choices.length - 1];
  const twoMonthsEarlier = addMonths(exportTo, -2);
  const exportFrom = twoMonthsEarlier < oldestChoice ? oldestChoice : twoMonthsEarlier;
  return (
    <>
      <PageHeader
        title={text.investorsTitle}
        description={text.investorsSubtitle}
        actions={
          <>
            <StatementExport
              action="/api/admin/investors/statements"
              title={text.statementPeriod.exportTitle}
              description={upcoming ? text.investorExport.descriptionAll : text.statementPeriod.exportDescription}
              selectedPeriod={upcoming ? undefined : { value: month, label: format.month(month) }}
              months={choices}
              defaultFrom={exportFrom}
              defaultTo={exportTo}
              hidden={{ status: explicitStatus ? status : undefined, q: search }}
            />
            <Link href="/admin/investors/new" className={buttonStyles()}>
              <Icon name="plusCircle" className="size-4" />
              {text.newInvestor}
            </Link>
          </>
        }
      />
      <InvestorCodeEditor>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex max-w-full flex-wrap items-end gap-3">
            <StatusFilter
              basePath="/admin/investors"
              current={status}
              query={{ q: search, month: monthQuery }}
              options={INVESTOR_LIST_FILTERS.map((filter) => ({
                value: filter,
                label: filter === "all" ? text.statusFilter.all : messages.investorStatus[filter],
              }))}
            />
            <form method="get" className="border-s border-line-strong ps-2">
              {explicitStatus && <input type="hidden" name="status" value={status} />}
              {search && <input type="hidden" name="q" value={search} />}
              <AutoSubmitSelect key={month} name="month" defaultValue={month} aria-label={text.investorMonth.label} variant="button">
                {months.map((choice) => <option key={choice} value={choice}>{format.month(choice)}</option>)}
              </AutoSubmitSelect>
              <noscript><button type="submit" className={buttonStyles({ size: "sm" })}>{text.searchButton}</button></noscript>
            </form>
            <InvestorCodeSaveBar />
          </div>
          <form method="get" role="search" className="flex gap-2">
            {explicitStatus ? <input type="hidden" name="status" value={status} /> : null}
            {monthQuery && <input type="hidden" name="month" value={monthQuery} />}
            <input
              type="search"
              name="q"
              defaultValue={search}
              aria-label={text.searchLabel}
              placeholder={text.searchPlaceholder}
              className={cn(inputStyles, "w-56")}
            />
            <button type="submit" className={buttonStyles({ variant: "secondary" })}>
              {text.searchButton}
            </button>
          </form>
        </div>
        <p className="mb-3 text-xs text-subtle">{upcoming ? text.statementPeriod.upcoming : text.statementPeriod.hint}</p>
        <Card>
          <InvestorTable investors={result.rows} period={period} statements={statements} />
          {result.totalCount > 0 && (
            <Pagination result={result} basePath="/admin/investors" query={{ q: search, status, month: monthQuery }} />
          )}
        </Card>
      </InvestorCodeEditor>
    </>
  );
}
