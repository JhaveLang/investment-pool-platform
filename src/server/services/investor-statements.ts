import "server-only";
import { CSV_DELIMITERS } from "@/i18n/config";
import type { I18n } from "@/i18n/server";
import type { StatementPeriod } from "@/lib/statement-period";
import { addDays, addMonths, firstDayOfMonth, monthOf, todayIsoDate } from "@/lib/calendar";
import {
  buildInvestorStatementCsv,
  buildInvestorsStatementCsv,
  monthsBetween,
  parseExportMonthRange,
} from "@/lib/statement-csv";
import { buildMonthStatements, buildPeriodStatement, firstStatementMonth } from "@/lib/statements";
import { getDb } from "@/server/db/client";
import type { InvestorStatus } from "@/server/db/schema";
import { getInvestorDetail, listInvestorsForExport } from "@/server/queries/admin";
import { getFirstDepositMonth, loadStatementData } from "@/server/queries/statements";
import { recordAudit } from "./audit";

type ExportContext = {
  /** The month range from the query ("YYYY-MM"); missing ends default to the first month and the current month. */
  query: { from: string | null; to: string | null };
  i18n: I18n;
  adminUserId: string;
  ipAddress: string | null;
};

export type StatementExport = { fileName: string; csv: string } | "invalid-range" | "not-found";

/** The monthly statement of every investor in the list's filter (all pages), in the admin's language. */
export async function exportInvestorStatements(
  input: ExportContext & { status: InvestorStatus | "all"; search?: string; period?: StatementPeriod; filterPeriod?: StatementPeriod },
): Promise<StatementExport> {
  const { messages, format, locale } = input.i18n;
  const { period } = input;
  const range = period ? { from: monthOf(period.from), to: monthOf(period.to) }
    : parseExportMonthRange(input.query, monthOf(todayIsoDate()), await getFirstDepositMonth());
  if (!range) {
    return "invalid-range";
  }
  const months = period ? [] : monthsBetween(range);
  const investors = await listInvestorsForExport({ status: input.status, search: input.search, period: input.filterPeriod });
  // The last month's return counts from the 1st of the following month.
  const data = await loadStatementData(
    investors.map((investor) => investor.accountId),
    period ? addDays(period.to, 1) : firstDayOfMonth(addMonths(range.to, 1)),
  );
  const rows = investors.map((investor) => {
    const { entries, movements } = data.get(investor.accountId) ?? { entries: [], movements: [] };
    return {
      investorCode: investor.investorCode,
      fullName: investor.fullName,
      statusLabel: messages.investorStatus[investor.deactivatedAt ? "deactivated" : "active"],
      statements: period ? [buildPeriodStatement(entries, movements, period)] : buildMonthStatements(entries, movements, months),
    };
  });
  const csv = buildInvestorsStatementCsv(rows, period ? [period] : months, messages.csv, format, CSV_DELIMITERS[locale]);

  await recordAudit(getDb(), {
    actorUserId: input.adminUserId,
    action: "report.exported",
    entityType: "report",
    entityId: "investorStatements",
    metadata: period ? { ...period } : { ...range },
    ipAddress: input.ipAddress,
  });
  const suffix = period?.value ?? `${range.from}-${range.to}`;
  const fileName = `${messages.admin.reports.investorStatements.fileName}-${suffix}.csv`;
  return { fileName, csv };
}

/** One investor's monthly statement; without a start month from their first deposit or booking. */
export async function exportInvestorStatement(input: ExportContext & { userId: string }): Promise<StatementExport> {
  const { messages, format, locale } = input.i18n;
  const investor = await getInvestorDetail(input.userId);
  if (!investor) {
    return "not-found";
  }
  const currentMonth = monthOf(todayIsoDate());
  const data = await loadStatementData([investor.accountId], firstDayOfMonth(addMonths(currentMonth, 1)));
  const { entries, movements } = data.get(investor.accountId) ?? { entries: [], movements: [] };
  const range = parseExportMonthRange(input.query, currentMonth, firstStatementMonth(entries, movements));
  if (!range) {
    return "invalid-range";
  }
  const statements = buildMonthStatements(entries, movements, monthsBetween(range));
  const csv = buildInvestorStatementCsv(investor, statements, messages.csv, format, CSV_DELIMITERS[locale]);

  await recordAudit(getDb(), {
    actorUserId: input.adminUserId,
    action: "report.exported",
    entityType: "report",
    entityId: "investorStatement",
    metadata: { ...range, investorName: investor.fullName, investorCode: investor.investorCode },
    ipAddress: input.ipAddress,
  });
  // ASCII only (the investor ID, not the name), so the file name needs no encoding in the header.
  const fileName = `${messages.admin.reports.investorStatement.fileName}-${investor.investorCode}-${range.from}-${range.to}.csv`;
  return { fileName, csv };
}
