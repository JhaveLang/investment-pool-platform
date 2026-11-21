import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const toneStyles = {
  neutral: "border-line-strong bg-overlay text-muted",
  success: "border-accent-400/25 bg-accent-400/10 text-accent-400",
  warning: "border-warn/25 bg-warn/10 text-warn",
  danger: "border-loss/25 bg-loss/10 text-loss",
  info: "border-indigo/25 bg-indigo/10 text-indigo",
} as const;

export type BadgeTone = keyof typeof toneStyles;

/** A state chip: uppercase micro-label on a tinted pill. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "label-caps inline-flex items-center gap-1 rounded-full border px-2 py-0.5 whitespace-nowrap",
        toneStyles[tone],
      )}
    >
      {children}
    </span>
  );
}
