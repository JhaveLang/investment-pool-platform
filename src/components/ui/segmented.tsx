import { cn } from "@/lib/cn";

/** A row of link chips for filters and sort orders; the active one is filled emerald. */
export const segmentGroupStyles = "flex flex-wrap gap-1.5";

export function segmentStyles(isActive: boolean): string {
  return cn(
    "rounded-full px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
    isActive ? "bg-accent-500 font-semibold text-accent-deep" : "bg-raised text-muted hover:bg-overlay hover:text-fg",
  );
}
