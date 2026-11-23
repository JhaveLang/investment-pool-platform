import { describe, expect, it } from "vitest";
import {
  investorNotificationHref,
  isAdminNotificationType,
  isInvestorNotificationType,
  isLiveNotificationAction,
  latestNotificationId,
  notificationHref,
  shouldInvestorPageRefresh,
  shouldRefreshOnNotification,
} from "./notifications";

describe("isAdminNotificationType", () => {
  it("accepts only the events the admin is notified about", () => {
    expect(isAdminNotificationType("withdrawal.requested")).toBe(true);
    expect(isAdminNotificationType("deposit.created")).toBe(true);
    expect(isAdminNotificationType("auth.registered")).toBe(true);
    expect(isAdminNotificationType("auth.login")).toBe(false);
    expect(isAdminNotificationType("deposit.reconciled")).toBe(false);
  });
});

describe("notificationHref", () => {
  it("links money movements to their review queue", () => {
    expect(notificationHref({ type: "withdrawal.requested", investorId: "a" })).toBe("/admin/withdrawals");
    expect(notificationHref({ type: "deposit.created", investorId: "a" })).toBe("/admin/deposits");
  });

  it("links a registration to the investor, or the list without one", () => {
    expect(notificationHref({ type: "auth.registered", investorId: "abc" })).toBe("/admin/investors/abc");
    expect(notificationHref({ type: "auth.registered", investorId: null })).toBe("/admin/investors");
  });
});

describe("shouldRefreshOnNotification", () => {
  it("reloads only pages whose content the events change", () => {
    for (const path of ["/admin", "/admin/deposits", "/admin/withdrawals", "/admin/investors"]) {
      expect(shouldRefreshOnNotification(path)).toBe(true);
    }
  });

  it("leaves pages with forms alone", () => {
    for (const path of ["/admin/investors/new", "/admin/returns", "/admin/investors/abc", "/admin/profile"]) {
      expect(shouldRefreshOnNotification(path)).toBe(false);
    }
  });
});

describe("latestNotificationId", () => {
  it("returns the highest id, or 0 for none", () => {
    expect(latestNotificationId([{ id: 3 }, { id: 9 }, { id: 5 }])).toBe(9);
    expect(latestNotificationId([])).toBe(0);
  });
});

describe("investor updates", () => {
  it("covers the admin decisions and booked months, nothing else", () => {
    for (const action of [
      "deposit.reconciled",
      "deposit.rejected",
      "withdrawal.approved",
      "withdrawal.rejected",
      "returns.booked",
    ]) {
      expect(isInvestorNotificationType(action)).toBe(true);
      expect(isAdminNotificationType(action)).toBe(false);
    }
    expect(isInvestorNotificationType("deposit.created")).toBe(false);
    expect(isInvestorNotificationType("auth.login")).toBe(false);
  });

  it("pushes both audiences' events and no others", () => {
    expect(isLiveNotificationAction("deposit.created")).toBe(true);
    expect(isLiveNotificationAction("withdrawal.approved")).toBe(true);
    expect(isLiveNotificationAction("report.exported")).toBe(false);
  });

  it("links to the request history or the ledger", () => {
    expect(investorNotificationHref("deposit.reconciled")).toBe("/deposit");
    expect(investorNotificationHref("withdrawal.rejected")).toBe("/withdraw");
    expect(investorNotificationHref("returns.booked")).toBe("/transactions");
  });

  it("reloads only pages without a money form", () => {
    expect(shouldInvestorPageRefresh("/dashboard")).toBe(true);
    expect(shouldInvestorPageRefresh("/transactions")).toBe(true);
    for (const path of ["/deposit", "/withdraw", "/profile"]) {
      expect(shouldInvestorPageRefresh(path)).toBe(false);
    }
  });
});
