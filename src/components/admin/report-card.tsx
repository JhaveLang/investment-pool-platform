import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { inputStyles } from "@/components/ui/form-field";
import { getI18n } from "@/i18n/server";
import type { ReportType } from "@/server/services/reports";

type ReportCardProps = {
  reportType: ReportType;
  /** Snapshot reports (current balances) have no date range. */
  supportsDateRange: boolean;
};

/** A plain GET form: the browser downloads the CSV directly, no client JavaScript needed. */
export async function ReportCard({ reportType, supportsDateRange }: ReportCardProps) {
  const { messages } = await getI18n();
  const text = messages.admin;
  const report = text.reports[reportType];

  return (
    <Card>
      <CardHeader title={report.title} description={report.description} />
      <CardContent>
        <form action={`/api/reports/${reportType}`} method="get" className="space-y-4">
          {supportsDateRange ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-muted">
                  {text.reportFrom}
                  <input type="date" name="from" className={`${inputStyles} mt-1.5`} />
                </label>
                <label className="text-sm font-medium text-muted">
                  {text.reportTo}
                  <input type="date" name="to" className={`${inputStyles} mt-1.5`} />
                </label>
              </div>
              <p className="text-xs text-subtle">{text.reportRangeHint}</p>
            </>
          ) : null}
          <button type="submit" className={buttonStyles({ variant: "secondary" })}>
            {text.reportDownload}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
