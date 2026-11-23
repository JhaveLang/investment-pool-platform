import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/actions/auth";
import { Icon } from "@/components/ui/icon";
import { ADMIN_DOCK_COUNT, type NavItem } from "@/config/navigation";
import { getI18n } from "@/i18n/server";
import { profilePathForRole } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { AccountMenu } from "./account-menu";
import { Brand, BrandMark } from "./brand";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileDock } from "./mobile-dock";
import { NavLinks } from "./nav-links";
import { RulesCard } from "./rules-card";
import { Avatar, UserChip } from "./user-chip";

type AppShellProps = {
  user: SessionUser;
  navItems: NavItem[];
  homeHref: string;
  /** Extra controls for both top bars, e.g. the admin's notification bell. */
  topBarActions?: ReactNode;
  children: ReactNode;
};

/** Sidebar and top bar from the `lg` breakpoint; below it, a compact top bar and a bottom dock. */
export async function AppShell({ user, navItems, homeHref, topBarActions, children }: AppShellProps) {
  const { messages } = await getI18n();
  const isAdmin = user.role === "admin";
  const roleLabel = isAdmin ? messages.nav.roleAdmin : messages.nav.roleInvestor;
  const dockItems = isAdmin ? navItems.slice(0, ADMIN_DOCK_COUNT) : navItems;
  const moreItems = isAdmin ? navItems.slice(ADMIN_DOCK_COUNT) : [];
  const logoutButton = (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-overlay hover:text-fg"
      >
        <Icon name="logOut" className="size-5" />
        {messages.nav.logout}
      </button>
    </form>
  );

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col justify-between overflow-y-auto bg-sidebar p-6 lg:flex">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Brand href={homeHref} />
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-muted">
              <span aria-hidden className="size-1.5 rounded-full bg-accent-400 motion-safe:animate-pulse" />
              <span className="label-caps">{isAdmin ? messages.nav.consoleAdmin : messages.nav.consoleInvestor}</span>
            </span>
          </div>
          <NavLinks items={navItems} />
        </div>
        <div className="flex flex-col gap-2 pt-6">
          <RulesCard role={user.role} />
          {logoutButton}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 bg-canvas/80 px-8 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:flex">
          {isAdmin ? (
            <form method="get" action="/admin/investors" role="search" className="w-full max-w-md">
              <label className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-muted focus-within:ring-2 focus-within:ring-accent-400">
                <Icon name="search" className="size-[18px]" />
                <input
                  type="search"
                  name="q"
                  aria-label={messages.admin.searchLabel}
                  placeholder={messages.admin.searchPlaceholder}
                  className="w-full bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
                />
              </label>
            </form>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-4">
            {topBarActions}
            <LocaleSwitcher />
            <UserChip user={user} />
          </div>
        </header>

        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-canvas/85 px-4 pt-[env(safe-area-inset-top)] shadow-[0_1px_8px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:hidden">
          <a href={homeHref} className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-display text-[15px] leading-tight font-bold tracking-tight text-fg">
                {messages.app.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <span aria-hidden className="size-1.5 rounded-full bg-accent-400 motion-safe:animate-pulse" />
                {roleLabel}
              </span>
            </span>
          </a>
          <div className="flex shrink-0 items-center gap-1">
            {topBarActions}
            <AccountMenu avatar={<Avatar user={user} />}>
              <div className="border-b border-line px-1 pb-3">
                <p className="truncate text-sm font-semibold text-fg">{user.fullName}</p>
                <p className="truncate text-xs text-subtle">{user.email}</p>
              </div>
              <Link
                href={profilePathForRole(user.role)}
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-overlay hover:text-fg"
              >
                <Icon name="users" className="size-5" />
                {messages.nav.profile}
              </Link>
              <div className="flex items-center justify-between gap-3 px-1 py-3">
                <span className="label-caps text-muted">{messages.nav.language}</span>
                <LocaleSwitcher />
              </div>
              {logoutButton}
            </AccountMenu>
          </div>
        </header>

        <main className="w-full flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-6 lg:px-8 lg:pt-6 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileDock items={dockItems} moreItems={moreItems} />
    </div>
  );
}
