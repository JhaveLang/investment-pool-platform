import { BookReturnForm } from "@/components/admin/book-return-form";
import { InvestorCode } from "@/components/admin/investor-code";
import { Alert } from "@/components/ui/alert";
import { SignedAmount } from "@/components/ui/amount";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n, pageMetadata } from "@/i18n/server";
import { addMonths, firstDayOfMonth } from "@/lib/calendar";
import { DomainError } from "@/lib/errors";
import { firstParam } from "@/lib/pagination";
import { getSchemas } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/guards";
import { getReturnSchedule, listReturnPeriods, type ReturnPeriodRow } from "@/server/queries/returns";
import { previewMonthlyReturn, type MonthlyReturnCalculation } from "@/server/services/returns";

export const generateMetadata = pageMetadata((messages) => messages.admin.returnsTitle);

type PreviewState =
  | { status: "none" }
  | { status: "invalid"; fieldErrors: Partial<Record<"month" | "rate", string>> }
  | { status: "rejected"; message: string }
  | { status: "ready"; calculation: MonthlyReturnCalculation };

export default async function AdminReturnsPage({ searchParams }: PageProps<"/admin/returns">) {
  await requireAdmin();
  const { locale, messages, format } = await getI18n();
  const text = messages.admin;
  const params = await searchParams;
  const monthParam = firstParam(params.month);
  const rateParam = firstParam(params.rate);
  const bookedMonth = firstParam(params.booked);

  const [schedule, periods] = await Promise.all([getReturnSchedule(), listReturnPeriods()]);
  const bookedPeriod = bookedMonth ? periods.find((period) => period.month === bookedMonth) : undefined;

  // Submitting the GET form below adds ?month=&rate=, which renders the preview.
  let preview: PreviewState = { status: "none" };
  if (monthParam !== undefined || rateParam !== undefined) {
    const parsed = getSchemas(locale).returnPreviewSchema.safeParse({ month: monthParam ?? "", rate: rateParam ?? "" });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<"month" | "rate", string>> = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] === "month" ? "month" : "rate";
        fieldErrors[fieldName] ??= issue.message;
      }
      preview = { status: "invalid", fieldErrors };
    } else {
      try {
        preview = { status: "ready", calculation: await previewMonthlyReturn(parsed.data.month, parsed.data.rate) };
      } catch (error) {
        if (!(error instanceof DomainError)) {
          throw error;
        }
        preview = { status: "rejected", message: messages.domainErrors[error.code] };
      }
    }
  }
  const fieldErrors = preview.status === "invalid" ? preview.fieldErrors : {};
  const selectedMonth =
    monthParam && schedule.bookableMonths.includes(monthParam) ? monthParam : schedule.bookableMonths[0];

  return (
    <>
      <PageHeader title={text.returnsTitle} description={text.returnsSubtitle} />

      {bookedPeriod ? (
        <Alert tone="success" className="mb-6">
          {text.returnsBooked(
            format.month(bookedPeriod.month),
            format.signedCurrency(bookedPeriod.totalCents),
            bookedPeriod.accountCount,
          )}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader title={text.returnsFormTitle} />
            <CardContent>
              {schedule.bookableMonths.length === 0 ? (
                <NothingBookable lastBookedMonth={schedule.lastBookedMonth} />
              ) : (
                <form method="get" className="space-y-4">
                  <div>
                    <label htmlFor="field-month" className="mb-1.5 block text-sm font-medium text-muted">
                      {text.returnsMonth}
                    </label>
                    <Select
                      id="field-month"
                      name="month"
                      defaultValue={selectedMonth}
                      aria-invalid={fieldErrors.month ? true : undefined}
                    >
                      {schedule.bookableMonths.map((month) => (
                        <option key={month} value={month}>
                          {format.month(month)}
                        </option>
                      ))}
                    </Select>
                    {fieldErrors.month ? <p className="mt-1.5 text-sm text-loss">{fieldErrors.month}</p> : null}
                  </div>
                  <FormField
                    name="rate"
                    label={text.returnsRate}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={text.returnsRatePlaceholder}
                    defaultValue={rateParam}
                    hint={text.returnsRateHint}
                    error={fieldErrors.rate}
                    required
                  />
                  <button type="submit" className={buttonStyles({ variant: "secondary" })}>
                    {text.returnsPreviewButton}
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={text.returnsRulesTitle} />
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
                {text.returnsRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {preview.status === "rejected" ? <Alert tone="error">{preview.message}</Alert> : null}
          {preview.status === "ready" ? (
            <ReturnPreview calculation={preview.calculation} rate={rateParam ?? ""} />
          ) : null}
          <Card>
            <CardHeader title={text.returnsHistoryTitle} />
            <ReturnHistory periods={periods} />
          </Card>
        </div>
      </div>
    </>
  );
}

async function NothingBookable({ lastBookedMonth }: { lastBookedMonth: string | null }) {
  const { messages, format } = await getI18n();
  if (!lastBookedMonth) {
    return <p className="text-sm text-muted">{messages.admin.returnsNoDeposits}</p>;
  }
  const nextMonth = addMonths(lastBookedMonth, 1);
  return (
    <p className="text-sm text-muted">
      {messages.admin.returnsNothingBookable(
        format.month(nextMonth),
        format.calendarDate(firstDayOfMonth(addMonths(nextMonth, 1))),
      )}
    </p>
  );
}

async function ReturnPreview({ calculation, rate }: { calculation: MonthlyReturnCalculation; rate: string }) {
  const { messages, format } = await getI18n();
  const text = messages.admin;
  const columns = messages.columns;
  const monthLabel = format.month(calculation.month);

  return (
    <Card>
      <CardHeader title={text.returnsPreviewTitle(monthLabel, format.rate(calculation.ratePpm))} />
      {calculation.pendingWithdrawalCount > 0 ? (
        <Alert tone="info" className="m-5 mb-0">
          {text.returnsPendingWithdrawals(calculation.pendingWithdrawalCount)}
        </Alert>
      ) : null}
      {calculation.rows.length === 0 ? (
        <EmptyState title={text.returnsPreviewEmpty} />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeaderCell>{columns.investor}</TableHeaderCell>
              <TableHeaderCell className="text-right">{columns.averageCapital}</TableHeaderCell>
              <TableHeaderCell className="text-right">{columns.return}</TableHeaderCell>
            </tr>
          </thead>
          <TableBody>
            {calculation.rows.map((row) => (
              <tr key={row.accountId}>
                <TableCell>
                  <p className="font-medium text-fg">{row.investorName}</p>
                  <InvestorCode code={row.investorCode} />
                  <p className="text-xs text-subtle">{row.investorEmail}</p>
                  {row.pausedDays > 0 ? (
                    <p className="text-xs text-warn">{text.returnsPausedDays(row.pausedDays)}</p>
                  ) : null}
                </TableCell>
                <TableCell className="amount text-right whitespace-nowrap">
                  {format.currency(row.averageCapitalCents)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <SignedAmount cents={row.returnCents} />
                  {row.capped ? <p className="text-xs text-warn">{text.returnsCapped}</p> : null}
                </TableCell>
              </tr>
            ))}
            <tr>
              <TableCell className="font-semibold text-fg">{text.returnsTotal}</TableCell>
              <TableCell />
              <TableCell className="text-right whitespace-nowrap">
                <SignedAmount cents={calculation.totalCents} className="text-base font-bold" />
              </TableCell>
            </tr>
          </TableBody>
        </Table>
      )}
      <CardContent className="border-t border-line">
        <BookReturnForm
          month={calculation.month}
          rate={rate}
          expectedTotalCents={calculation.totalCents}
          submitLabel={text.returnsBookButton(monthLabel)}
        />
      </CardContent>
    </Card>
  );
}

async function ReturnHistory({ periods }: { periods: ReturnPeriodRow[] }) {
  const { messages, format } = await getI18n();
  const columns = messages.columns;

  if (periods.length === 0) {
    return <EmptyState title={messages.admin.returnsHistoryEmpty} />;
  }
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>{columns.month}</TableHeaderCell>
          <TableHeaderCell className="text-right">{columns.rate}</TableHeaderCell>
          <TableHeaderCell className="text-right">{columns.return}</TableHeaderCell>
          <TableHeaderCell className="text-right">{columns.accounts}</TableHeaderCell>
          <TableHeaderCell>{columns.bookedAt}</TableHeaderCell>
          <TableHeaderCell>{columns.bookedBy}</TableHeaderCell>
        </tr>
      </thead>
      <TableBody>
        {periods.map((period) => (
          <tr key={period.id}>
            <TableCell className="font-medium whitespace-nowrap text-fg">{format.month(period.month)}</TableCell>
            <TableCell className="amount text-right whitespace-nowrap">{format.rate(period.ratePpm)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <SignedAmount cents={period.totalCents} />
            </TableCell>
            <TableCell className="amount text-right">{period.accountCount}</TableCell>
            <TableCell className="whitespace-nowrap">{format.dateTime(period.createdAt)}</TableCell>
            <TableCell>{period.bookedByName}</TableCell>
          </tr>
        ))}
      </TableBody>
    </Table>
  );
}
