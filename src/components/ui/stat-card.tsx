import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StatCardProps = {
  label: string;
  value: string;
  /** A delta chip or icon tile in the top-right corner. */
  aside?: ReactNode;
  /** Sparkline, meter or detail rows under the figure. */
  children?: ReactNode;
  className?: string;
  valueTestId?: string;
};

export function StatGroup({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("grid gap-4", className)}>{children}</section>;
}

/** A key figure: uppercase name, large number, and supporting detail underneath. */
export function StatCard({ label, value, aside, children, className, valueTestId }: StatCardProps) {
  return (
    <div className={cn("@container flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4", className)}>
      {/* The aside wraps under the figure when the card is too narrow for both. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-[1_1_7.5rem]">
          <p className="label-caps hyphens-auto text-muted">{label}</p>
          {/* Scales with the card so seven-digit totals still fit four across. */}
          <p
            className="mt-1 font-display text-[length:clamp(1.125rem,11cqi,1.5rem)] leading-tight font-bold tracking-tight whitespace-nowrap text-fg"
            data-testid={valueTestId}
          >
            {value}
          </p>
        </div>
        {aside}
      </div>
      {children ? <div className="mt-auto pt-4">{children}</div> : null}
    </div>
  );
}

/** Emerald (or salmon) delta pill for a stat card. */
export function DeltaChip({ value, negative = false }: { value: string; negative?: boolean }) {
  return (
    <span
      className={cn(
        "label-caps inline-flex shrink-0 items-center rounded-full px-2 py-0.5",
        negative ? "bg-loss/10 text-loss" : "bg-accent-400/10 text-accent-400",
      )}
    >
      {value}
    </span>
  );
}
