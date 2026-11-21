import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { adminNavItems } from "@/config/navigation";
import { requireAdmin } from "@/server/auth/guards";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return (
    <AppShell user={user} navItems={adminNavItems} homeHref="/admin">
      {children}
    </AppShell>
  );
}
