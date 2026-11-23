import type { AuditAction } from "@/server/db/schema";

/** Activity-log actions the admin is told about the moment they happen. */
export const ADMIN_NOTIFICATION_TYPES = [
  "withdrawal.requested",
  "deposit.created",
  "auth.registered",
] as const satisfies readonly AuditAction[];

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];

/** One entry in the admin's notification bell. Plain data, so it can be streamed and passed to the client. */
export type AdminNotification = {
  /** Id of the activity-log entry; increases over time, so it also orders and de-duplicates notifications. */
  id: number;
  type: AdminNotificationType;
  /** ISO timestamp. */
  createdAt: string;
  investorId: string | null;
  investorName: string | null;
  investorCode: string | null;
  amountCents: number | null;
  reference: string | null;
};

export function isAdminNotificationType(action: string): action is AdminNotificationType {
  return (ADMIN_NOTIFICATION_TYPES as readonly string[]).includes(action);
}

/** Where a notification leads: the review queue for money movements, the investor for a registration. */
export function notificationHref(notification: Pick<AdminNotification, "type" | "investorId">): string {
  switch (notification.type) {
    case "withdrawal.requested":
      return "/admin/withdrawals";
    case "deposit.created":
      return "/admin/deposits";
    case "auth.registered":
      return notification.investorId ? `/admin/investors/${notification.investorId}` : "/admin/investors";
  }
}

/**
 * Admin pages whose content a notification changes. Only these reload on a live event; elsewhere a reload could
 * disturb a half-filled form (new investor, monthly result), so the bell and the toast are enough.
 */
const LIVE_REFRESH_PATHS: readonly string[] = ["/admin", "/admin/deposits", "/admin/withdrawals", "/admin/investors"];

export function shouldRefreshOnNotification(pathname: string): boolean {
  return LIVE_REFRESH_PATHS.includes(pathname);
}

/**
 * Activity-log actions that change an investor's balance or requests. Only that investor (or, for a booked month,
 * every investor who received a return) is told, so their open pages update without a reload.
 */
export const INVESTOR_NOTIFICATION_TYPES = [
  "deposit.reconciled",
  "deposit.rejected",
  "withdrawal.approved",
  "withdrawal.rejected",
  "returns.booked",
] as const satisfies readonly AuditAction[];

export type InvestorNotificationType = (typeof INVESTOR_NOTIFICATION_TYPES)[number];

/** A live update for one investor. Plain data, so it can be streamed to the browser. */
export type InvestorNotification = {
  /** Id of the activity-log entry, as for admin notifications. */
  id: number;
  type: InvestorNotificationType;
  /** ISO timestamp. */
  createdAt: string;
  /** Deposit: credited amount (after fee). Withdrawal: payout. Booked month: the investor's own return (signed). */
  amountCents: number | null;
  /** Booking reference of the deposit or withdrawal. */
  reference: string | null;
  /** Booked month as YYYY-MM. */
  month: string | null;
};

export function isInvestorNotificationType(action: string): action is InvestorNotificationType {
  return (INVESTOR_NOTIFICATION_TYPES as readonly string[]).includes(action);
}

/** Activity-log actions that are pushed to open pages (admin or investor). */
export function isLiveNotificationAction(action: string): boolean {
  return isAdminNotificationType(action) || isInvestorNotificationType(action);
}

/** Where an investor's update leads: the request history, or the ledger for a booked month. */
export function investorNotificationHref(type: InvestorNotificationType): string {
  switch (type) {
    case "deposit.reconciled":
    case "deposit.rejected":
      return "/deposit";
    case "withdrawal.approved":
    case "withdrawal.rejected":
      return "/withdraw";
    case "returns.booked":
      return "/transactions";
  }
}

/**
 * Investor pages that reload on a live update. Deposit and withdrawal pages are left alone: a reload would issue a
 * new idempotency key under a form the investor may be filling in (the same reason the dashboard has no live form).
 */
const INVESTOR_LIVE_REFRESH_PATHS: readonly string[] = ["/dashboard", "/transactions"];

export function shouldInvestorPageRefresh(pathname: string): boolean {
  return INVESTOR_LIVE_REFRESH_PATHS.includes(pathname);
}

/** The highest id in a list, or 0 for an empty one (activity-log ids start at 1). */
export function latestNotificationId(notifications: readonly Pick<AdminNotification, "id">[]): number {
  return notifications.reduce((highest, notification) => Math.max(highest, notification.id), 0);
}
