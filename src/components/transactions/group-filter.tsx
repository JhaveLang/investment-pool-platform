import Link from "next/link";
import { segmentGroupStyles, segmentStyles } from "@/components/ui/segmented";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { ENTRY_GROUPS, type EntryGroup } from "@/lib/ledger-groups";
import type { EntryGroupCounts } from "@/server/queries/ledger";

type GroupFilterProps = {
  counts: EntryGroupCounts;
  active?: EntryGroup;
  basePath: string;
  /** Other query parameters to keep, e.g. the sort order. */
  query?: Record<string, string | undefined>;
  className?: string;
};

function hrefFor(basePath: string, group: EntryGroup | undefined, query: GroupFilterProps["query"]): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  if (group) {
    searchParams.set("group", group);
  }
  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/** "Alle (23) · Einzahlungen (8) · Rendite (6) · Auszahlungen (3)" as filter chips. */
export async function GroupFilter({ counts, active, basePath, query, className }: GroupFilterProps) {
  const { messages } = await getI18n();
  const labels = messages.transactions.groups;
  const options: Array<{ group?: EntryGroup; label: string; count: number }> = [
    { label: labels.all, count: counts.all },
    ...ENTRY_GROUPS.map((group) => ({ group, label: labels[group], count: counts[group] })),
  ];

  return (
    <nav
      aria-label={messages.transactions.filterLabel}
      className={cn(segmentGroupStyles, "scrollbar-none flex-nowrap overflow-x-auto", className)}
    >
      {options.map((option) => (
        <Link
          key={option.group ?? "all"}
          href={hrefFor(basePath, option.group, query)}
          aria-current={option.group === active ? "page" : undefined}
          className={segmentStyles(option.group === active)}
        >
          {option.label} ({option.count})
        </Link>
      ))}
    </nav>
  );
}
