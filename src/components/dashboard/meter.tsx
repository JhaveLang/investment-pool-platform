import { cn } from "@/lib/cn";

/** A thin progress bar; `value` from 0 to 1. Decorative unless given a label. */
export function Meter({ value, className, label }: { value: number; className?: string; label?: string }) {
  const percent = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(percent) : undefined}
      aria-hidden={label ? undefined : true}
      className="h-1.5 w-full overflow-hidden rounded-full bg-overlay"
    >
      <div className={cn("h-full rounded-full bg-accent-400", className)} style={{ width: `${percent}%` }} />
    </div>
  );
}
