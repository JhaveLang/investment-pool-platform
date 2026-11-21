import { WithdrawalReviewTable } from "@/components/admin/review-tables";
import { StatusFilter } from "@/components/admin/status-filter";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getI18n, pageMetadata } from "@/i18n/server";
import { parseChoiceParam, parsePageParam } from "@/lib/pagination";
import { requireAdmin } from "@/server/auth/guards";
import type { WithdrawalStatus } from "@/server/db/schema";
import { listWithdrawalsForReview, type ReviewFilter } from "@/server/queries/admin";

const FILTERS: readonly ReviewFilter<WithdrawalStatus>[] = ["pending", "approved", "rejected", "all"];

export const generateMetadata = pageMetadata((messages) => messages.admin.withdrawalsTitle);

export default async function AdminWithdrawalsPage({ searchParams }: PageProps<"/admin/withdrawals">) {
  await requireAdmin();
  const { messages } = await getI18n();
  const text = messages.admin;
  const params = await searchParams;
  const status = parseChoiceParam(params.status, FILTERS, "pending");
  const result = await listWithdrawalsForReview({ status, page: parsePageParam(params.page) });

  return (
    <>
      <PageHeader
        title={text.withdrawalsTitle}
        description={text.withdrawalsSubtitle}
        actions={
          <StatusFilter
            basePath="/admin/withdrawals"
            current={status}
            options={FILTERS.map((filter) => ({
              value: filter,
              label: filter === "all" ? text.statusFilter.all : messages.withdrawalStatus[filter],
            }))}
          />
        }
      />
      <Card>
        <WithdrawalReviewTable withdrawals={result.rows} />
        {result.totalCount > 0 ? (
          <Pagination result={result} basePath="/admin/withdrawals" query={{ status }} />
        ) : null}
      </Card>
    </>
  );
}
