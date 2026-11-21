import { ReportCard } from "@/components/admin/report-card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";
import { REPORT_TYPES } from "@/server/services/reports";

export const generateMetadata = pageMetadata((messages) => messages.admin.reportsTitle);

export default async function AdminReportsPage() {
  await requireAdmin();
  const text = (await getI18n()).messages.admin;

  return (
    <>
      <PageHeader title={text.reportsTitle} description={text.reportsSubtitle} />
      <div className="grid gap-6 md:grid-cols-2">
        {REPORT_TYPES.map((reportType) => (
          <ReportCard key={reportType} reportType={reportType} supportsDateRange={reportType !== "balances"} />
        ))}
      </div>
    </>
  );
}
