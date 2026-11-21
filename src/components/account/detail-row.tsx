import type { ReactNode } from "react";

/** One label/value line inside a `<dl>`; stacks on phones, label beside value from `sm`. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="label-caps text-muted sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-fg">{children}</dd>
    </div>
  );
}
