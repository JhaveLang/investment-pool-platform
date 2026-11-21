import { DepositReviewTable } from "@/components/admin/review-tables";
import { StatusFilter } from "@/components/admin/status-filter";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getI18n, pageMetadata } from "@/i18n/server";
import { parseChoiceParam, parsePageParam } from "@/lib/pagination";
import { requireAdmin } from "@/server/auth/guards";
import type { DepositStatus } from "@/server/db/schema";
import { listDepositsForReview, type ReviewFilter } from "@/server/queries/admin";

const FILTERS: readonly ReviewFilter<DepositStatus>[] = ["pending", "reconciled", "rejected", "all"];

export const generateMetadata = pageMetadata((messages) => messages.admin.depositsTitle);

export default async function AdminDepositsPage({ searchParams }: PageProps<"/admin/deposits">) {
  await requireAdmin();
  const { messages } = await getI18n();
  const text = messages.admin;
  const params = await searchParams;
  const status = parseChoiceParam(params.status, FILTERS, "pending");
  const result = await listDepositsForReview({ status, page: parsePageParam(params.page) });

  return (
    <>
      <PageHeader
        title={text.depositsTitle}
        description={text.depositsSubtitle}
        actions={
          <StatusFilter
            basePath="/admin/deposits"
            current={status}
            options={FILTERS.map((filter) => ({
              value: filter,
              label: filter === "all" ? text.statusFilter.all : messages.depositStatus[filter],
            }))}
          />
        }
      />
      <Card>
        <DepositReviewTable deposits={result.rows} />
        {result.totalCount > 0 ? <Pagination result={result} basePath="/admin/deposits" query={{ status }} /> : null}
      </Card>
    </>
  );
}
