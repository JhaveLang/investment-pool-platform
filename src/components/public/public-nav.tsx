"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export type PublicNavItem = { href: string; label: string };

function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** The website's tabs from `md`; the current one is underlined in emerald. */
export function PublicNav({ items, label }: { items: PublicNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-fg after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-accent-400"
                : "text-muted hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

type PublicMobileMenuProps = {
  items: PublicNavItem[];
  label: string;
  /** Shown below the tabs, e.g. the account link and the language switch. */
  children: ReactNode;
};

/**
 * Below `md`: a menu button that unfolds the tabs (a `<details>`, closed again when a link is followed). The panel is
 * opaque: inside the blurred header a second backdrop blur has no effect.
 */
export function PublicMobileMenu({ items, label, children }: PublicMobileMenuProps) {
  const pathname = usePathname();
  const closeMenu = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a")) {
      event.currentTarget.closest("details")?.removeAttribute("open");
    }
  };

  return (
    <details className="group">
      <summary
        aria-label={label}
        className="grid size-10 cursor-pointer list-none place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg [&::-webkit-details-marker]:hidden"
      >
        <Icon name="list" className="size-5 group-open:hidden" />
        <Icon name="close" className="hidden size-5 group-open:block" />
      </summary>
      <div
        onClick={closeMenu}
        className="absolute inset-x-0 top-full border-b border-line bg-canvas px-4 pt-2 pb-5 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.6)]"
      >
        <nav aria-label={label} className="flex flex-col">
          {items.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-3 text-[15px] font-medium",
                  active ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-4">{children}</div>
      </div>
    </details>
  );
}
