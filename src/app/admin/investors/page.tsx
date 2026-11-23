import Link from "next/link";
import { InvestorTable } from "@/components/admin/investor-table";
import { StatusFilter } from "@/components/admin/status-filter";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputStyles } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getI18n, pageMetadata } from "@/i18n/server";
import { firstParam, parseChoiceParam, parsePageParam } from "@/lib/pagination";
import { requireAdmin } from "@/server/auth/guards";
import type { InvestorStatus } from "@/server/db/schema";
import { listInvestors } from "@/server/queries/admin";

const MAX_SEARCH_LENGTH = 100;

const FILTERS: readonly (InvestorStatus | "all")[] = ["active", "deactivated", "all"];

export const generateMetadata = pageMetadata((messages) => messages.admin.investorsTitle);

export default async function AdminInvestorsPage({ searchParams }: PageProps<"/admin/investors">) {
  await requireAdmin();
  const { messages } = await getI18n();
  const text = messages.admin;
  const params = await searchParams;
  const search = firstParam(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  // A search (e.g. from the top bar) without a chosen status looks through every investor.
  const explicitStatus = firstParam(params.status);
  const status = parseChoiceParam(explicitStatus, FILTERS, search ? "all" : "active");
  const result = await listInvestors({ status, search, page: parsePageParam(params.page) });

  return (
    <>
      <PageHeader
        title={text.investorsTitle}
        description={text.investorsSubtitle}
        actions={
          <Link href="/admin/investors/new" className={buttonStyles()}>
            <Icon name="plusCircle" className="size-4" />
            {text.newInvestor}
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusFilter
          basePath="/admin/investors"
          current={status}
          query={{ q: search }}
          options={FILTERS.map((filter) => ({
            value: filter,
            label: filter === "all" ? text.statusFilter.all : messages.investorStatus[filter],
          }))}
        />
        <form method="get" role="search" className="flex gap-2">
          {explicitStatus ? <input type="hidden" name="status" value={status} /> : null}
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
      </div>
      <Card>
        <InvestorTable investors={result.rows} />
        {result.totalCount > 0 ? (
          <Pagination result={result} basePath="/admin/investors" query={{ q: search, status }} />
        ) : null}
      </Card>
    </>
  );
}
