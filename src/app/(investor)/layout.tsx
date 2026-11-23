import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { InvestorLiveUpdates } from "@/components/layout/investor-live-updates";
import { investorNavItems } from "@/config/navigation";
import { requireInvestor } from "@/server/auth/guards";
import { getLatestAuditLogId } from "@/server/queries/notifications";

export default async function InvestorLayout({ children }: { children: ReactNode }) {
  const user = await requireInvestor();
  // Live updates start after the newest activity-log entry, so nothing decided while the page loads is missed.
  const afterId = await getLatestAuditLogId();
  return (
    <InvestorLiveUpdates afterId={afterId}>
      <AppShell user={user} navItems={investorNavItems} homeHref="/dashboard">
        {children}
      </AppShell>
    </InvestorLiveUpdates>
  );
}
