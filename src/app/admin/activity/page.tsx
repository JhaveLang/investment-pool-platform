import { ActivityLogTable } from "@/components/admin/activity-log-table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getI18n, pageMetadata } from "@/i18n/server";
import { parsePageParam } from "@/lib/pagination";
import { requireAdmin } from "@/server/auth/guards";
import { listAuditLogs } from "@/server/queries/admin";

export const generateMetadata = pageMetadata((messages) => messages.admin.activityTitle);

export default async function AdminActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin();
  const text = (await getI18n()).messages.admin;
  const params = await searchParams;
  const result = await listAuditLogs({ page: parsePageParam(params.page) });

  return (
    <>
      <PageHeader title={text.activityTitle} description={text.activitySubtitle} />
      <Card>
        <ActivityLogTable entries={result.rows} />
        {result.totalCount > 0 ? <Pagination result={result} basePath="/admin/activity" /> : null}
      </Card>
    </>
  );
}
