"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEventStream, useToasts } from "@/components/live-events";
import type { IconName } from "@/components/ui/icon";
import { Toast, ToastRegion } from "@/components/ui/toast";
import { useFormatter, useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/dictionaries";
import type { Formatter } from "@/lib/format";
import {
  investorNotificationHref,
  shouldInvestorPageRefresh,
  type InvestorNotification,
  type InvestorNotificationType,
} from "@/lib/notifications";

const typeIcons: Record<InvestorNotificationType, { icon: IconName; tone: string }> = {
  "deposit.reconciled": { icon: "bank", tone: "text-accent-400" },
  "deposit.rejected": { icon: "close", tone: "text-loss" },
  "withdrawal.approved": { icon: "shieldCheck", tone: "text-accent-400" },
  "withdrawal.rejected": { icon: "undo", tone: "text-warn" },
  "returns.booked": { icon: "trendingUp", tone: "text-accent-400" },
};

function describe(update: InvestorNotification, text: Messages["liveUpdates"], format: Formatter): string {
  const reference = update.reference ?? "";
  switch (update.type) {
    case "deposit.reconciled":
      return text.depositReconciled(format.currency(update.amountCents ?? 0), reference);
    case "deposit.rejected":
      return text.depositRejected(reference);
    case "withdrawal.approved":
      return text.withdrawalApproved(format.currency(update.amountCents ?? 0), reference);
    case "withdrawal.rejected":
      return text.withdrawalRejected(reference);
    case "returns.booked":
      return text.returnsBooked(format.month(update.month ?? ""), format.signedCurrency(update.amountCents ?? 0));
  }
}

/**
 * Live updates for the signed-in investor: when the admin decides one of their requests or books a monthly return,
 * a toast appears and the dashboard and ledger reload their data at once, so the new balance shows without a manual
 * refresh. Only this investor's events arrive (the server picks them by session).
 */
export function InvestorLiveUpdates({ afterId, children }: { afterId: number; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const text = useMessages().liveUpdates;
  const format = useFormatter();
  const { toasts, show, dismiss } = useToasts<InvestorNotification>();
  // Fixed at first render: later refreshes re-render the layout with a newer id, which must not reopen the stream.
  const [streamAfterId] = useState(afterId);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEventStream<InvestorNotification>(`/api/investor/notifications?after=${streamAfterId}`, (update) => {
    show(update);
    if (shouldInvestorPageRefresh(pathnameRef.current)) {
      router.refresh();
    }
  });

  return (
    <>
      {children}
      <ToastRegion>
        {toasts.map((toast) => {
          const icon = toast.type === "returns.booked" && (toast.amountCents ?? 0) < 0 ? "trendingDown" : null;
          return (
            <Toast
              key={toast.id}
              icon={icon ?? typeIcons[toast.type].icon}
              iconTone={icon ? "text-loss" : typeIcons[toast.type].tone}
              label={text.types[toast.type]}
              href={investorNotificationHref(toast.type)}
              linkLabel={text.view}
              onDismiss={() => dismiss(toast.id)}
              dismissLabel={text.dismiss}
            >
              {describe(toast, text, format)}
            </Toast>
          );
        })}
      </ToastRegion>
    </>
  );
}
