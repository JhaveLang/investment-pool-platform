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
import { addMonths, firstDayOfMonth, isIsoMonth, monthOf, todayIsoDate, type IsoMonth } from "@/lib/calendar";
import { firstParam, parseChoiceParam, parsePageParam } from "@/lib/pagination";
import { buildMonthStatement, type MonthStatement } from "@/lib/statements";
import { requireAdmin } from "@/server/auth/guards";
import { INVESTOR_LIST_FILTERS, listInvestors } from "@/server/queries/admin";
import { getFirstDepositMonth, loadStatementData } from "@/server/queries/statements";

const MAX_SEARCH_LENGTH = 100;
/** How many months the month filter offers, newest first. */
const MONTH_CHOICES = 24;

export const generateMetadata = pageMetadata((messages) => messages.admin.investorsTitle);

/** The current month and back to the first deposit (at most `MONTH_CHOICES`), plus the chosen month if older. */
function monthChoices(currentMonth: IsoMonth, firstMonth: IsoMonth | null, chosen: IsoMonth): IsoMonth[] {
  const choices: IsoMonth[] = [];
  const oldest = firstMonth && firstMonth < currentMonth ? firstMonth : currentMonth;
  for (let month = currentMonth; month >= oldest && choices.length < MONTH_CHOICES; month = addMonths(month, -1)) {
    choices.push(month);
  }
  return choices.includes(chosen) ? choices : [...choices, chosen];
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
  // The month the investment, return and miscellaneous columns show; the current month unless chosen.
  const currentMonth = monthOf(todayIsoDate());
  const requestedMonth = firstParam(params.month);
  const month =
    requestedMonth && isIsoMonth(requestedMonth) && requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const monthQuery = month === currentMonth ? undefined : month;

  const [result, firstMonth] = await Promise.all([
    listInvestors({ status, search, page: parsePageParam(params.page) }),
    getFirstDepositMonth(),
  ]);
  // The month's return is booked in the next month and counts from its 1st, so load up to then.
  const statementData = await loadStatementData(
    result.rows.map((row) => row.accountId),
    firstDayOfMonth(addMonths(month, 1)),
  );
  const choices = monthChoices(currentMonth, firstMonth, month);
  // The CSV offers the shown month and the two before it, like the client's sheet.
  const oldestChoice = choices[choices.length - 1];
  const exportFrom = addMonths(month, -2) < oldestChoice ? oldestChoice : addMonths(month, -2);
  const statements: Record<string, MonthStatement> = {};
  for (const [accountId, data] of statementData) {
    statements[accountId] = buildMonthStatement(data.entries, data.movements, month);
  }

  return (
    <>
      <PageHeader
        title={text.investorsTitle}
        description={text.investorsSubtitle}
        actions={
          <>
            <StatementExport
              action="/api/admin/investors/statements"
              title={text.investorExport.titleAll}
              description={text.investorExport.descriptionAll}
              months={choices}
              defaultFrom={exportFrom}
              defaultTo={month}
              hidden={{ status: explicitStatus ? status : undefined, q: search }}
            />
            <Link href="/admin/investors/new" className={buttonStyles()}>
              <Icon name="plusCircle" className="size-4" />
              {text.newInvestor}
            </Link>
          </>
        }
      />
      {/* Investor IDs are edited in place in the table; the save button sits beside the month select. */}
      <InvestorCodeEditor>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusFilter
              basePath="/admin/investors"
              current={status}
              query={{ q: search, month: monthQuery }}
              options={INVESTOR_LIST_FILTERS.map((filter) => ({
                value: filter,
                label: filter === "all" ? text.statusFilter.all : messages.investorStatus[filter],
              }))}
            />
            {/* Its own form, so changing the month keeps the search and the status filter. */}
            <form method="get" className="flex items-center gap-2">
              {explicitStatus ? <input type="hidden" name="status" value={status} /> : null}
              {search ? <input type="hidden" name="q" value={search} /> : null}
              <label className="flex items-center gap-2">
                <span className="label-caps text-muted">{text.investorMonth.label}</span>
                <AutoSubmitSelect name="month" defaultValue={month}>
                  {choices.map((choice) => (
                    <option key={choice} value={choice}>
                      {format.month(choice)}
                    </option>
                  ))}
                </AutoSubmitSelect>
              </label>
            </form>
            <InvestorCodeSaveBar />
          </div>
          <form method="get" role="search" className="flex gap-2">
            {explicitStatus ? <input type="hidden" name="status" value={status} /> : null}
            {monthQuery ? <input type="hidden" name="month" value={monthQuery} /> : null}
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
        <p className="mb-3 text-xs text-subtle">{text.investorMonth.hint}</p>
        <Card>
          <InvestorTable investors={result.rows} month={month} statements={statements} />
          {result.totalCount > 0 ? (
            <Pagination result={result} basePath="/admin/investors" query={{ q: search, status, month: monthQuery }} />
          ) : null}
        </Card>
      </InvestorCodeEditor>
    </>
  );
}
