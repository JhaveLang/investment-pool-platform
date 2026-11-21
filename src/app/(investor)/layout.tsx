import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { investorNavItems } from "@/config/navigation";
import { requireInvestor } from "@/server/auth/guards";

export default async function InvestorLayout({ children }: { children: ReactNode }) {
  const user = await requireInvestor();
  return (
    <AppShell user={user} navItems={investorNavItems} homeHref="/dashboard">
      {children}
    </AppShell>
  );
}
