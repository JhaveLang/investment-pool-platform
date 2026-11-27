"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { isNavItemActive, type NavItem } from "@/config/navigation";
import { useMessages } from "@/i18n/client";
import { cn } from "@/lib/cn";

/** The sidebar's vertical navigation; the active entry is filled plum. */
export function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();
  const messages = useMessages();

  return (
    <nav aria-label={messages.nav.mainNavigation} className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => {
        const isActive = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors",
              isActive ? "bg-accent-400 font-semibold text-accent-ink" : "text-muted hover:bg-overlay hover:text-fg",
            )}
          >
            <Icon name={item.icon} className="size-5" />
            {messages.nav[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
