import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import type { PaginatedResult } from "@/lib/pagination";
import { Icon } from "./icon";

type PaginationProps = {
  result: Pick<PaginatedResult<unknown>, "page" | "pageSize" | "totalPages" | "totalCount">;
  basePath: string;
  /** Other query parameters (filters, sort) to keep when changing pages. */
  query?: Record<string, string | undefined>;
  /** The query parameter holding the page; a second pager on the same page needs its own. */
  param?: string;
  /** Element id to scroll to after changing pages, when the list isn't at the top of the page. */
  fragment?: string;
};

type HrefOptions = Pick<PaginationProps, "basePath" | "query" | "param" | "fragment">;

function buildPageHref({ basePath, query, param = "page", fragment }: HrefOptions, page: number): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  if (page > 1) {
    searchParams.set(param, String(page));
  }
  const queryString = searchParams.toString();
  return `${queryString ? `${basePath}?${queryString}` : basePath}${fragment ? `#${fragment}` : ""}`;
}

/** First, last, and the current page with its neighbours; `null` marks a gap. */
function visiblePages(page: number, totalPages: number): Array<number | null> {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);
  const withGaps: Array<number | null> = [];
  sorted.forEach((candidate, index) => {
    if (index > 0 && candidate - sorted[index - 1] > 1) {
      withGaps.push(null);
    }
    withGaps.push(candidate);
  });
  return withGaps;
}

const cellStyles = "grid h-8 min-w-8 place-items-center rounded-lg px-2 text-[13px] font-semibold transition-colors";

export async function Pagination({ result, ...hrefOptions }: PaginationProps) {
  const { messages } = await getI18n();
  const { page, pageSize, totalPages, totalCount } = result;
  const firstShown = (page - 1) * pageSize + 1;
  const lastShown = Math.min(totalCount, page * pageSize);
  const stepStyles = cn(cellStyles, "bg-raised text-muted hover:bg-overlay hover:text-fg");
  const disabledStepStyles = cn(cellStyles, "pointer-events-none bg-raised text-subtle opacity-40");

  return (
    <nav
      aria-label={messages.common.pagination}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-[13px] text-muted"
    >
      <p>{messages.common.showingRange(firstShown, lastShown, totalCount)}</p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={buildPageHref(hrefOptions, page - 1)}
            className={stepStyles}
            aria-label={messages.common.previous}
          >
            <Icon name="chevronLeft" className="size-4" />
          </Link>
        ) : (
          <span aria-hidden className={disabledStepStyles}>
            <Icon name="chevronLeft" className="size-4" />
          </span>
        )}
        {visiblePages(page, totalPages).map((candidate, index) =>
          candidate === null ? (
            <span key={`gap-${index}`} aria-hidden className="px-1 text-subtle">
              …
            </span>
          ) : (
            <Link
              key={candidate}
              href={buildPageHref(hrefOptions, candidate)}
              aria-current={candidate === page ? "page" : undefined}
              className={cn(
                cellStyles,
                candidate === page ? "bg-accent-400 text-accent-ink" : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              {candidate}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link href={buildPageHref(hrefOptions, page + 1)} className={stepStyles} aria-label={messages.common.next}>
            <Icon name="chevronRight" className="size-4" />
          </Link>
        ) : (
          <span aria-hidden className={disabledStepStyles}>
            <Icon name="chevronRight" className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
