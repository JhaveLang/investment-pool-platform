import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";

/** Three rising columns in emerald on the highest surface: the pool growing month by month. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-lg bg-highest", className)}>
      <svg viewBox="0 0 24 24" className="size-[58%] text-accent-400" fill="currentColor">
        <rect x="3.5" y="13" width="4.5" height="7.5" rx="1.5" />
        <rect x="9.75" y="8.5" width="4.5" height="12" rx="1.5" />
        <rect x="16" y="3.5" width="4.5" height="17" rx="1.5" />
      </svg>
    </span>
  );
}

type BrandProps = {
  href?: string;
  size?: "md" | "lg";
  /** Shows only the mark on phones, where the top bar is tight. */
  compactOnMobile?: boolean;
};

export async function Brand({ href = "/", size = "md", compactOnMobile = false }: BrandProps) {
  const { messages } = await getI18n();
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center font-display font-bold tracking-tight text-fg",
        size === "lg" ? "gap-3.5 text-2xl" : "gap-2.5 text-lg",
      )}
    >
      <BrandMark className={size === "lg" ? "size-12" : "size-8"} />
      <span className={cn(compactOnMobile && "max-sm:sr-only")}>{messages.app.name}</span>
    </Link>
  );
}
