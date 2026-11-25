import type { IconName } from "@/components/ui/icon";
import type { Messages } from "@/i18n/dictionaries";

type NavMessages = Messages["nav"];
/** The plain-text entries of `messages.nav` (it also holds formatters for the sidebar's rule card). */
type NavLabelKey = { [Key in keyof NavMessages]: NavMessages[Key] extends string ? Key : never }[keyof NavMessages];

export type NavItem = {
  href: string;
  /** Key into `messages.nav`, resolved in the active language when rendering. */
  labelKey: NavLabelKey;
  icon: IconName;
  /** Highlight only on an exact match (for section roots like /admin). */
  exact?: boolean;
  /** Further path prefixes that highlight this item, e.g. /withdraw for "Geld bewegen". */
  alsoActiveOn?: string[];
};

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return [item.href, ...(item.alsoActiveOn ?? [])].some((prefix) => pathname.startsWith(prefix));
}

// Deposit and withdraw share one "Geld bewegen" entry; both pages switch between each other.
export const investorNavItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: "grid" },
  { href: "/deposit", labelKey: "moveMoney", icon: "swap", alsoActiveOn: ["/withdraw"] },
  { href: "/transactions", labelKey: "transactions", icon: "list" },
];

export const adminNavItems: NavItem[] = [
  { href: "/admin", labelKey: "adminOverview", icon: "grid", exact: true },
  { href: "/admin/deposits", labelKey: "adminDeposits", icon: "inbox" },
  { href: "/admin/withdrawals", labelKey: "adminWithdrawals", icon: "send" },
  { href: "/admin/investors", labelKey: "adminInvestors", icon: "users" },
  { href: "/admin/returns", labelKey: "adminReturns", icon: "trendingUp" },
  { href: "/admin/pool", labelKey: "adminPool", icon: "bank" },
  { href: "/admin/reports", labelKey: "adminReports", icon: "file" },
  { href: "/admin/news", labelKey: "adminNews", icon: "globe" },
  { href: "/admin/activity", labelKey: "adminActivity", icon: "activity" },
];

/** The admin entries that fit the phone dock; the rest open from "Mehr". */
export const ADMIN_DOCK_COUNT = 3;
