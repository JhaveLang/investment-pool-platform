"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useEventStream, useToasts, type ConnectionStatus } from "@/components/live-events";
import { buttonStyles } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Toast, ToastRegion } from "@/components/ui/toast";
import { useFormatter, useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import type { Formatter } from "@/lib/format";
import {
  latestNotificationId,
  notificationHref,
  shouldRefreshOnNotification,
  type AdminNotification,
  type AdminNotificationType,
} from "@/lib/notifications";
import { InvestorCode } from "./investor-code";

const MAX_ITEMS = 20;

type NotificationsContextValue = {
  items: AdminNotification[];
  /** Everything up to this id counts as read. */
  seenId: number;
  status: ConnectionStatus;
  markAllSeen: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const typeIcons: Record<AdminNotificationType, { icon: IconName; tone: string }> = {
  "withdrawal.requested": { icon: "arrowUpRight", tone: "text-warn" },
  "deposit.created": { icon: "bank", tone: "text-accent-400" },
  "auth.registered": { icon: "users", tone: "text-indigo" },
};

// The read marker is a per-browser convenience in localStorage; private windows or blocked storage just show no
// unread count for older entries.
const SEEN_STORAGE_KEY = "admin-notifications-seen";
const seenListeners = new Set<() => void>();

function readSeenId(): number | null {
  try {
    const stored = window.localStorage.getItem(SEEN_STORAGE_KEY);
    const id = Number(stored);
    return stored !== null && Number.isSafeInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function writeSeenId(id: number): void {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, String(id));
  } catch {
    // Storage unavailable: the marker only lives until the page is reloaded.
  }
  seenListeners.forEach((listener) => listener());
}

function subscribeToSeenId(listener: () => void): () => void {
  seenListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    seenListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function describe(notification: AdminNotification, text: Messages["notifications"], format: Formatter): string {
  const name = notification.investorName ?? text.someone;
  const amount = format.currency(notification.amountCents ?? 0);
  switch (notification.type) {
    case "withdrawal.requested":
      return text.withdrawalRequested(name, amount);
    case "deposit.created":
      return text.depositCreated(name, amount);
    case "auth.registered":
      return text.investorRegistered(name);
  }
}

/**
 * Holds the admin's live notification stream (one connection per tab) and shows a toast for every new event. On the
 * pages the event changes (overview, queues, investor list) it also reloads the server data, so new requests appear
 * without a manual refresh. The bells in the top bars read the state from here.
 */
export function AdminNotificationsProvider({
  initial,
  children,
}: {
  initial: AdminNotification[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [items, setItems] = useState(initial);
  const { toasts, show, dismiss } = useToasts<AdminNotification>();
  // The stream starts after the newest entry the server rendered, so nothing logged in between is missed.
  const [streamAfterId] = useState(() => latestNotificationId(initial));
  const storedSeenId = useSyncExternalStore(subscribeToSeenId, readSeenId, () => null);
  // Without a stored marker (first visit), what was already there when the page loaded counts as read.
  const seenId = storedSeenId ?? streamAfterId;

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const status = useEventStream<AdminNotification>(
    `/api/admin/notifications?after=${streamAfterId}`,
    (notification) => {
      setItems((current) =>
        current.some((item) => item.id === notification.id) ? current : [notification, ...current].slice(0, MAX_ITEMS),
      );
      show(notification);
      if (shouldRefreshOnNotification(pathnameRef.current)) {
        router.refresh();
      }
    },
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({ items, seenId, status, markAllSeen: () => writeSeenId(latestNotificationId(items)) }),
    [items, seenId, status],
  );

  return (
    <NotificationsContext value={value}>
      {children}
      <NotificationToasts toasts={toasts} onDismiss={dismiss} />
    </NotificationsContext>
  );
}

function NotificationIcon({ type }: { type: AdminNotificationType }) {
  const { icon, tone } = typeIcons[type];
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-raised", tone)}>
      <Icon name={icon} className="size-[18px]" />
    </span>
  );
}

function NotificationToasts({ toasts, onDismiss }: { toasts: AdminNotification[]; onDismiss: (id: number) => void }) {
  const messages = useMessages();
  const text = messages.notifications;
  const format = useFormatter();

  return (
    <ToastRegion>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          icon={typeIcons[toast.type].icon}
          iconTone={typeIcons[toast.type].tone}
          label={text.types[toast.type]}
          href={notificationHref(toast)}
          linkLabel={text.view}
          onDismiss={() => onDismiss(toast.id)}
          dismissLabel={text.dismiss}
        >
          {describe(toast, text, format)} <InvestorCode code={toast.investorCode} />
        </Toast>
      ))}
    </ToastRegion>
  );
}

const statusStyles: Record<ConnectionStatus, string> = {
  live: "bg-accent-400 motion-safe:animate-pulse",
  connecting: "bg-warn",
  offline: "bg-loss",
};

/** The bell in the top bar: unread count, and a panel with the latest events. */
export function NotificationBell() {
  const context = use(NotificationsContext);
  const messages = useMessages();
  const text = messages.notifications;
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  // Entries newer than this were unread when the panel was opened; they keep their marker while it stays open.
  const [highlightAfterId, setHighlightAfterId] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!context) {
    return null;
  }
  const { items, seenId, status, markAllSeen } = context;
  const unreadCount = items.filter((item) => item.id > seenId).length;
  const statusLabel = { live: text.live, connecting: text.connecting, offline: text.offline }[status];

  const toggle = () => {
    if (!open) {
      setHighlightAfterId(seenId);
      markAllSeen();
    }
    setOpen(!open);
  };

  return (
    // On phones the panel spans the top bar (its positioned ancestor); from `lg` it hangs below the bell.
    <div ref={rootRef} className="lg:relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={text.open(unreadCount)}
        className={buttonStyles({ size: "icon", variant: open ? "selected" : "ghost", className: "relative" })}
      >
        <Icon name="bell" className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-warn px-1 text-[10px] leading-none font-bold text-canvas">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute inset-x-4 top-full z-50 mt-2 rounded-2xl border border-line bg-surface p-2 shadow-[0_16px_32px_-8px_rgba(29,22,33,0.16)] lg:inset-x-auto lg:right-0 lg:w-[22rem]">
          <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-2">
            <p className="font-display text-[15px] font-semibold text-fg">{text.title}</p>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden className={cn("size-1.5 rounded-full", statusStyles[status])} />
              {statusLabel}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="px-2 pt-1 pb-3 text-[13px] text-muted">{text.empty}</p>
          ) : (
            <ul className="flex max-h-[min(26rem,70vh)] flex-col gap-1 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={notificationHref(item)}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-highest"
                  >
                    <NotificationIcon type={item.type} />
                    <span className="min-w-0 flex-1">
                      <span className="label-caps flex items-center gap-1.5 text-muted">
                        {text.types[item.type]}
                        {item.id > highlightAfterId ? (
                          <span aria-hidden className="size-1.5 rounded-full bg-warn" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-fg">
                        {describe(item, text, format)} <InvestorCode code={item.investorCode} />
                      </span>
                      <span className="mt-0.5 block text-xs text-subtle">
                        {format.dateTime(new Date(item.createdAt))}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
