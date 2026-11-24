import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** Label/value rows summarising a booking before it is submitted. */
export function Breakdown({ rows }: { rows: Array<{ label: string; value: ReactNode; emphasis?: boolean }> }) {
  return (
    <dl className="flex flex-col gap-2.5 rounded-xl bg-raised p-4 text-[13px]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4">
          <dt className="text-muted">{row.label}</dt>
          <dd className={cn("amount text-right font-semibold", row.emphasis ? "text-gain" : "text-fg")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The resulting balance in large brand-colored figures. */
export function ProjectedBalance({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-well px-4 py-3.5">
      <span className="flex items-center gap-2.5 text-[13px] whitespace-nowrap text-muted">
        <span className="grid size-8 place-items-center rounded-full bg-accent-400/10 text-accent-400">
          <Icon name="trendingUp" className="size-4" />
        </span>
        {label}
      </span>
      <span className="amount font-display text-lg font-bold text-accent-400 sm:text-xl">{value}</span>
    </div>
  );
}
