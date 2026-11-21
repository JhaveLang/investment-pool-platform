import "server-only";
import { CSV_DELIMITERS } from "@/i18n/config";
import type { I18n } from "@/i18n/server";
import { buildCsv, type CsvColumn } from "@/lib/csv";
import { formatIsoDate } from "@/lib/format";
import { formatPayoutDestination } from "@/lib/iban";
import { getDb } from "@/server/db/client";
import type { DateRange } from "@/server/queries/filters";
import {
  loadBalanceExportRows,
  loadDepositExportRows,
  loadLedgerExportRows,
  loadWithdrawalExportRows,
} from "@/server/queries/reports";
import { recordAudit } from "./audit";

export const REPORT_TYPES = ["transactions", "deposits", "withdrawals", "balances"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

type ReportDefinition<Row> = {
  loadRows: (range: DateRange) => Promise<Row[]>;
  columns: CsvColumn<Row>[];
};

/** Erases the row type so differently shaped reports fit in one registry. */
function defineReport<Row>(definition: ReportDefinition<Row>) {
  return async (range: DateRange, delimiter: string) =>
    buildCsv(definition.columns, await definition.loadRows(range), delimiter);
}

/** Column headers, status labels and number/date formats follow the admin's language. */
function createReportBuilders({ messages, format }: I18n): Record<ReportType, ReturnType<typeof defineReport>> {
  const csvText = messages.csv;
  const optionalDateTime = (value: Date | null) => (value ? format.exportDateTime(value) : null);

  return {
    transactions: defineReport({
      loadRows: loadLedgerExportRows,
      columns: [
        { header: csvText.entryNumber, value: (row) => row.id },
        { header: csvText.dateTime, value: (row) => format.exportDateTime(row.createdAt) },
        { header: csvText.investor, value: (row) => row.investorName },
        { header: csvText.investorId, value: (row) => row.investorCode },
        { header: csvText.email, value: (row) => row.investorEmail },
        { header: csvText.entryType, value: (row) => messages.entryTypes[row.entryType] },
        { header: csvText.amount, value: (row) => format.decimal(row.amountCents) },
        { header: csvText.balanceAfter, value: (row) => format.decimal(row.balanceAfterCents) },
        { header: csvText.reference, value: (row) => row.reference },
      ],
    }),
    deposits: defineReport({
      loadRows: loadDepositExportRows,
      columns: [
        { header: csvText.dateTime, value: (row) => format.exportDateTime(row.createdAt) },
        { header: csvText.reference, value: (row) => row.reference },
        { header: csvText.investor, value: (row) => row.investorName },
        { header: csvText.investorId, value: (row) => row.investorCode },
        { header: csvText.email, value: (row) => row.investorEmail },
        { header: csvText.method, value: (row) => messages.paymentMethods[row.method] },
        { header: csvText.amount, value: (row) => format.decimal(row.amountCents) },
        { header: csvText.fee, value: (row) => format.decimal(row.feeCents) },
        { header: csvText.credited, value: (row) => format.decimal(row.amountCents - row.feeCents) },
        { header: csvText.status, value: (row) => messages.depositStatus[row.status] },
        { header: csvText.receivedOn, value: (row) => (row.receivedOn ? format.calendarDate(row.receivedOn) : null) },
        { header: csvText.reviewedAt, value: (row) => optionalDateTime(row.reviewedAt) },
        { header: csvText.note, value: (row) => row.reviewNote },
      ],
    }),
    withdrawals: defineReport({
      loadRows: loadWithdrawalExportRows,
      columns: [
        { header: csvText.dateTime, value: (row) => format.exportDateTime(row.createdAt) },
        { header: csvText.reference, value: (row) => row.reference },
        { header: csvText.investor, value: (row) => row.investorName },
        { header: csvText.investorId, value: (row) => row.investorCode },
        { header: csvText.email, value: (row) => row.investorEmail },
        { header: csvText.method, value: (row) => messages.paymentMethods[row.method] },
        { header: csvText.amount, value: (row) => format.decimal(row.amountCents) },
        { header: csvText.fee, value: (row) => format.decimal(row.feeCents) },
        { header: csvText.debited, value: (row) => format.decimal(row.amountCents + row.feeCents) },
        { header: csvText.destination, value: (row) => formatPayoutDestination(row) },
        { header: csvText.status, value: (row) => messages.withdrawalStatus[row.status] },
        { header: csvText.reviewedAt, value: (row) => optionalDateTime(row.reviewedAt) },
        { header: csvText.note, value: (row) => row.reviewNote },
      ],
    }),
    balances: defineReport({
      loadRows: loadBalanceExportRows,
      columns: [
        { header: csvText.investor, value: (row) => row.investorName },
        { header: csvText.investorId, value: (row) => row.investorCode },
        { header: csvText.email, value: (row) => row.investorEmail },
        { header: csvText.balance, value: (row) => format.decimal(row.balanceCents) },
        { header: csvText.registeredAt, value: (row) => format.exportDateTime(row.registeredAt) },
      ],
    }),
  };
}

type ExportReportInput = {
  reportType: ReportType;
  range: DateRange;
  i18n: I18n;
  adminUserId: string;
  ipAddress: string | null;
};

/** Builds the CSV in the admin's language and records the export in the activity log. */
export async function exportReport(input: ExportReportInput): Promise<{ fileName: string; csv: string }> {
  const buildReportCsv = createReportBuilders(input.i18n)[input.reportType];
  const csv = await buildReportCsv(input.range, CSV_DELIMITERS[input.i18n.locale]);

  await recordAudit(getDb(), {
    actorUserId: input.adminUserId,
    action: "report.exported",
    entityType: "report",
    entityId: input.reportType,
    metadata: { ...input.range },
    ipAddress: input.ipAddress,
  });

  const fileNamePrefix = input.i18n.messages.admin.reports[input.reportType].fileName;
  return { fileName: `${fileNamePrefix}-${formatIsoDate(new Date())}.csv`, csv };
}
