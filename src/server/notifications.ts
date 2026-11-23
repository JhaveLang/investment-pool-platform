import "server-only";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import type { AdminNotification, InvestorNotification } from "@/lib/notifications";
import type { DbExecutor } from "@/server/db/client";
import { getDatabaseUrl } from "@/server/env";
import { getLiveEvent } from "@/server/queries/notifications";

/**
 * Live updates over PostgreSQL LISTEN/NOTIFY. `recordAudit` sends a NOTIFY inside the booking's transaction, so
 * PostgreSQL delivers it only once the booking has committed. Each server process keeps one listening connection and
 * passes every event on to the open streams: admin notifications to every admin page, investor updates only to the
 * pages of the investor they concern (`/api/admin/notifications`, `/api/investor/notifications`).
 */
const CHANNEL = "live_events";
const RECONNECT_DELAY_MS = 2_000;

type AdminListener = (notification: AdminNotification) => void;
type InvestorListener = (notification: InvestorNotification) => void;

type Hub = {
  adminListeners: Set<AdminListener>;
  /** Keyed by investor user id. */
  investorListeners: Map<string, Set<InvestorListener>>;
  client: Client | null;
  connecting: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

// Kept on globalThis so hot reloads in development don't open a second listening connection.
const globalForHub = globalThis as typeof globalThis & { liveEventHub?: Hub };
const hub: Hub = (globalForHub.liveEventHub ??= {
  adminListeners: new Set(),
  investorListeners: new Map(),
  client: null,
  connecting: null,
  reconnectTimer: null,
});

function hasListeners(): boolean {
  return hub.adminListeners.size > 0 || hub.investorListeners.size > 0;
}

/** Queues a live update for the activity-log entry; call it with the transaction that wrote the entry. */
export async function notifyLiveListeners(executor: DbExecutor, auditLogId: number): Promise<void> {
  await executor.execute(sql`select pg_notify(${CHANNEL}, ${String(auditLogId)})`);
}

function callEach<Event>(listeners: Iterable<(event: Event) => void>, event: Event): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("[notifications] Listener failed", error);
    }
  }
}

async function deliver(payload: string | undefined): Promise<void> {
  const auditLogId = Number(payload);
  if (!Number.isSafeInteger(auditLogId) || !hasListeners()) {
    return;
  }
  const event = await getLiveEvent(auditLogId);
  if (event.admin) {
    callEach(hub.adminListeners, event.admin);
  }
  for (const { userId, notification } of event.investors) {
    callEach(hub.investorListeners.get(userId) ?? [], notification);
  }
}

function scheduleReconnect(): void {
  if (hub.reconnectTimer || !hasListeners()) {
    return;
  }
  hub.reconnectTimer = setTimeout(() => {
    hub.reconnectTimer = null;
    ensureListening().catch((error: unknown) => console.error("[notifications] Reconnect failed", error));
  }, RECONNECT_DELAY_MS);
}

async function ensureListening(): Promise<void> {
  if (hub.client) {
    return;
  }
  hub.connecting ??= (async () => {
    const client = new Client({ connectionString: getDatabaseUrl() });
    const drop = (reason: unknown) => {
      if (hub.client === client) {
        hub.client = null;
        console.error("[notifications] Listening connection lost", reason);
        client.end().catch(() => undefined);
        scheduleReconnect();
      }
    };
    client.on("error", drop);
    client.on("end", () => drop("connection ended"));
    client.on("notification", (message) => {
      if (message.channel === CHANNEL) {
        deliver(message.payload).catch((error: unknown) => console.error("[notifications] Delivery failed", error));
      }
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      hub.client = client;
    } catch (error) {
      await client.end().catch(() => undefined);
      scheduleReconnect();
      throw error;
    }
  })().finally(() => {
    hub.connecting = null;
  });
  await hub.connecting;
}

/** Registers a listener, makes sure this process listens, and returns the unsubscribe function. */
async function subscribe(add: () => void, remove: () => void): Promise<() => void> {
  add();
  try {
    await ensureListening();
  } catch (error) {
    remove();
    throw error;
  }
  return remove;
}

/**
 * Calls `listener` for every admin notification committed from now on, in this process. Returns the unsubscribe
 * function. The listening connection stays open for later subscribers.
 */
export async function subscribeToAdminNotifications(listener: AdminListener): Promise<() => void> {
  return subscribe(
    () => hub.adminListeners.add(listener),
    () => hub.adminListeners.delete(listener),
  );
}

/** Calls `listener` for every update concerning this investor, committed from now on, in this process. */
export async function subscribeToInvestorNotifications(
  userId: string,
  listener: InvestorListener,
): Promise<() => void> {
  return subscribe(
    () => {
      const listeners = hub.investorListeners.get(userId) ?? new Set<InvestorListener>();
      listeners.add(listener);
      hub.investorListeners.set(userId, listeners);
    },
    () => {
      const listeners = hub.investorListeners.get(userId);
      listeners?.delete(listener);
      if (listeners?.size === 0) {
        hub.investorListeners.delete(userId);
      }
    },
  );
}
