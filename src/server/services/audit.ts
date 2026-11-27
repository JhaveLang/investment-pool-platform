import "server-only";
import { isLiveNotificationAction } from "@/lib/notifications";
import type { DbExecutor } from "@/server/db/client";
import { auditLogs, type AuditAction } from "@/server/db/schema";
import { notifyLiveListeners } from "@/server/notifications";

export type AuditEntry = {
  actorUserId: string | null;
  action: AuditAction;
  entityType?: "user" | "deposit" | "withdrawal" | "return_period" | "report" | "news" | "pool" | "promotion" | "promo_booking" | "promo_maturity_batch";
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

/**
 * Appends to the activity log. Pass the open transaction for money movements so the
 * log entry is committed (or rolled back) together with the booking it describes.
 * Entries the admin or the affected investor should see at once also update their open
 * pages; the update goes out only when that same transaction commits.
 */
export async function recordAudit(executor: DbExecutor, entry: AuditEntry): Promise<number> {
  const [logged] = await executor
    .insert(auditLogs)
    .values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress ?? null,
    })
    .returning({ id: auditLogs.id });
  if (isLiveNotificationAction(entry.action)) {
    await notifyLiveListeners(executor, logged.id);
  }
  return logged.id;
}
