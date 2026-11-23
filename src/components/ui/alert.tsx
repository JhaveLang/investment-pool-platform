import type { ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

const toneStyles = {
  success: "border-gain/30 bg-gain/8 text-fg [--alert-dot:var(--color-gain)]",
  error: "border-loss/35 bg-loss/8 text-fg [--alert-dot:var(--color-loss)]",
  info: "border-accent-400/30 bg-accent-400/8 text-fg [--alert-dot:var(--color-accent-400)]",
  warning: "border-warn/35 bg-warn/8 text-fg [--alert-dot:var(--color-warn)]",
} as const;

type AlertProps = {
  tone: keyof typeof toneStyles;
  children: ReactNode;
  className?: string;
};

export function Alert({ tone, children, className }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", toneStyles[tone], className)}
    >
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-(--alert-dot)" />
      <div>{children}</div>
    </div>
  );
}

/** Renders the outcome of a Server Action, or nothing while idle. */
export function ActionStateAlert({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle") {
    return null;
  }
  return (
    <Alert tone={state.status} className={className}>
      {state.message}
    </Alert>
  );
}
