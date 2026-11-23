import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

/** Bottom-right stack for short-lived messages, above the phone dock; screen readers announce new ones politely. */
export function ToastRegion({ children }: { children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 lg:right-8 lg:bottom-8"
    >
      {children}
    </div>
  );
}

type ToastProps = {
  icon: IconName;
  /** Text colour class for the icon, e.g. `text-accent-400`. */
  iconTone: string;
  label: string;
  children: ReactNode;
  href: string;
  linkLabel: string;
  onDismiss: () => void;
  dismissLabel: string;
};

/** One message: icon, caps label, text, a link and a close button. */
export function Toast({ icon, iconTone, label, children, href, linkLabel, onDismiss, dismissLabel }: ToastProps) {
  return (
    <div className="pointer-events-auto flex gap-3 rounded-xl border border-white/10 bg-overlay p-3 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.6)]">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-raised", iconTone)}>
        <Icon name={icon} className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="label-caps text-muted">{label}</p>
        <p className="mt-0.5 text-[13px] text-fg">{children}</p>
        <Link
          href={href}
          onClick={onDismiss}
          className="label-caps mt-1.5 inline-block text-accent-400 hover:text-accent-300"
        >
          {linkLabel}
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-highest hover:text-fg"
      >
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );
}
