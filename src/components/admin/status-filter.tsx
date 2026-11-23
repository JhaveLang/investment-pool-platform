import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { segmentGroupStyles, segmentStyles } from "@/components/ui/segmented";

type StatusFilterProps<Value extends string> = {
  basePath: string;
  current: Value;
  options: Array<{ value: Value; label: string }>;
  /** Other query parameters (e.g. the search) to keep when switching. */
  query?: Record<string, string | undefined>;
};

function buildFilterHref(basePath: string, status: string, query: StatusFilterProps<string>["query"]): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  searchParams.set("status", status);
  return `${basePath}?${searchParams.toString()}`;
}

export async function StatusFilter<Value extends string>({
  basePath,
  current,
  options,
  query,
}: StatusFilterProps<Value>) {
  const { messages } = await getI18n();

  return (
    <nav aria-label={messages.admin.statusFilter.label} className={segmentGroupStyles}>
      {options.map((option) => {
        const isActive = option.value === current;
        return (
          <Link
            key={option.value}
            href={buildFilterHref(basePath, option.value, query)}
            aria-current={isActive ? "page" : undefined}
            className={segmentStyles(isActive)}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
