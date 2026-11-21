import { InvestorTable } from "@/components/admin/investor-table";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputStyles } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getI18n, pageMetadata } from "@/i18n/server";
import { firstParam, parsePageParam } from "@/lib/pagination";
import { requireAdmin } from "@/server/auth/guards";
import { listInvestors } from "@/server/queries/admin";

const MAX_SEARCH_LENGTH = 100;

export const generateMetadata = pageMetadata((messages) => messages.admin.investorsTitle);

export default async function AdminInvestorsPage({ searchParams }: PageProps<"/admin/investors">) {
  await requireAdmin();
  const text = (await getI18n()).messages.admin;
  const params = await searchParams;
  const search = firstParam(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  const result = await listInvestors({ search, page: parsePageParam(params.page) });

  return (
    <>
      <PageHeader
        title={text.investorsTitle}
        description={text.investorsSubtitle}
        actions={
          <form method="get" role="search" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={search}
              aria-label={text.searchLabel}
              placeholder={text.searchPlaceholder}
              className={`${inputStyles} w-56`}
            />
            <button type="submit" className={buttonStyles({ variant: "secondary" })}>
              {text.searchButton}
            </button>
          </form>
        }
      />
      <Card>
        <InvestorTable investors={result.rows} />
        {result.totalCount > 0 ? (
          <Pagination result={result} basePath="/admin/investors" query={{ q: search }} />
        ) : null}
      </Card>
    </>
  );
}
