"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useEventStream, useToasts } from "@/components/live-events";
import type { IconName } from "@/components/ui/icon";
import { Toast, ToastRegion } from "@/components/ui/toast";
import { useFormatter, useMessages } from "@/i18n/client";
import {
  describeInvestorNotification,
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

type InvestorToast = Omit<ComponentProps<typeof Toast>, "onDismiss" | "dismissLabel">;
const InvestorToastContext = createContext<((toast: InvestorToast) => void) | null>(null);

export function useInvestorToast() {
  const show = useContext(InvestorToastContext);
  if (!show) throw new Error("Investor toasts require InvestorLiveUpdates");
  return show;
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
  const { toasts, show, dismiss } = useToasts<InvestorToast & { id: number }>();
  // Activity-log IDs are positive. Local feedback shares the stack using negative IDs.
  const localId = useRef(0);
  // Fixed at first render: later refreshes re-render the layout with a newer id, which must not reopen the stream.
  const [streamAfterId] = useState(afterId);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEventStream<InvestorNotification>(`/api/investor/notifications?after=${streamAfterId}`, (update) => {
    const loss = update.type === "returns.booked" && (update.amountCents ?? 0) < 0;
    show({
      id: update.id,
      icon: loss ? "trendingDown" : typeIcons[update.type].icon,
      iconTone: loss ? "text-loss" : typeIcons[update.type].tone,
      label: text.types[update.type],
      href: investorNotificationHref(update.type),
      linkLabel: text.view,
      children: describeInvestorNotification(update, text, format),
    });
    if (shouldInvestorPageRefresh(pathnameRef.current)) {
      router.refresh();
    }
  });

  return (
    <InvestorToastContext.Provider value={(toast) => show({ ...toast, id: --localId.current })}>
      {children}
      <ToastRegion>
        {toasts.map(({ id, ...toast }) => (
          <Toast key={id} {...toast} onDismiss={() => dismiss(id)} dismissLabel={text.dismiss} />
        ))}
      </ToastRegion>
    </InvestorToastContext.Provider>
  );
}
