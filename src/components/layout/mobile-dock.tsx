"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { isNavItemActive, type NavItem } from "@/config/navigation";
import { useMessages } from "@/i18n/client";
import { cn } from "@/lib/cn";

type MobileDockProps = {
  items: NavItem[];
  /** Entries that don't fit the dock; they open in a sheet from "Mehr". */
  moreItems?: NavItem[];
};

function dockTabStyles(active: boolean) {
  return buttonStyles({
    variant: active ? "selected" : "ghost",
    size: "sm",
    className: cn("min-h-11 min-w-0 flex-1 flex-col gap-1 px-0.5 py-1", !active && "text-muted"),
  });
}

function DockTab({ href, icon, label, isActive }: { href: string; icon: IconName; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={dockTabStyles(isActive)}
    >
      <Icon name={icon} className="size-[22px]" />
      <span className="label-caps max-w-full truncate px-0.5 text-[10px] tracking-normal normal-case">{label}</span>
    </Link>
  );
}

/** Fixed bottom navigation on phones. */
export function MobileDock({ items, moreItems = [] }: MobileDockProps) {
  const pathname = usePathname();
  const messages = useMessages();
  // The layout survives client navigation, so the sheet counts as open only on the route it was
  // opened on: following one of its links closes it without an extra render.
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null);
  const isSheetOpen = openedOnPath === pathname;
  const setIsSheetOpen = (open: boolean) => setOpenedOnPath(open ? pathname : null);
  const isMoreActive = moreItems.some((item) => isNavItemActive(item, pathname));

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpenedOnPath(null);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isSheetOpen]);

  return (
    <>
      {isSheetOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={messages.nav.closeMenu}
            onClick={() => setIsSheetOpen(false)}
            className="absolute inset-0 bg-well/70 backdrop-blur-sm"
          />
          <div
            id="mobile-more-sheet"
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] shadow-[0_-16px_32px_-8px_rgba(29,22,33,0.16)]"
          >
            <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line-strong" />
            <nav aria-label={messages.nav.more} className="flex flex-col gap-1">
              {moreItems.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium",
                      isActive ? "bg-accent-400 font-semibold text-accent-ink" : "text-fg hover:bg-highest",
                    )}
                  >
                    <Icon name={item.icon} className="size-5" />
                    {messages.nav[item.labelKey]}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}

      <nav
        aria-label={messages.nav.mainNavigation}
        className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/90 shadow-[0_-4px_16px_rgba(29,22,33,0.08)] backdrop-blur-xl lg:hidden"
      >
        <div className="flex h-16 items-center justify-around px-1">
          {items.map((item) => (
            <DockTab
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={messages.nav[item.labelKey]}
              isActive={!isSheetOpen && isNavItemActive(item, pathname)}
            />
          ))}
          {moreItems.length > 0 ? (
            <button
              type="button"
              aria-expanded={isSheetOpen}
              aria-controls="mobile-more-sheet"
              onClick={() => setIsSheetOpen(!isSheetOpen)}
              className={dockTabStyles(isSheetOpen || isMoreActive)}
            >
              <Icon name={isSheetOpen ? "close" : "more"} className="size-[22px]" />
              <span className="label-caps max-w-full truncate px-0.5 text-[10px] tracking-normal normal-case">
                {messages.nav.more}
              </span>
            </button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
