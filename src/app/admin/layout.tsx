import type { ReactNode } from "react";
import { AdminNotificationsProvider, NotificationBell } from "@/components/admin/admin-notifications";
import { AppShell } from "@/components/layout/app-shell";
import { adminNavItems } from "@/config/navigation";
import { requireAdmin } from "@/server/auth/guards";
import { listAdminNotifications } from "@/server/queries/notifications";

const INITIAL_NOTIFICATIONS = 10;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const notifications = await listAdminNotifications({ limit: INITIAL_NOTIFICATIONS });
  return (
    <AdminNotificationsProvider initial={notifications}>
      <AppShell user={user} navItems={adminNavItems} homeHref="/admin" topBarActions={<NotificationBell />}>
        {children}
      </AppShell>
    </AdminNotificationsProvider>
  );
}
