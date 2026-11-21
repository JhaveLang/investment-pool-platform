import "server-only";
import type { DbExecutor } from "@/server/db/client";
import { auditLogs, type AuditAction } from "@/server/db/schema";

export type AuditEntry = {
  actorUserId: string | null;
  action: AuditAction;
  entityType?: "user" | "deposit" | "withdrawal" | "return_period" | "report";
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

/**
 * Appends to the activity log. Pass the open transaction for money movements so the
 * log entry is committed (or rolled back) together with the booking it describes.
 */
export async function recordAudit(executor: DbExecutor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
    ipAddress: entry.ipAddress ?? null,
  });
}
