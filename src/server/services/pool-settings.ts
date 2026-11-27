import "server-only";
import type { PoolSettings } from "@/lib/pool-settings";
import { getDb } from "@/server/db/client";
import { poolSettings } from "@/server/db/schema";
import { recordAudit } from "./audit";

type UpdatePoolSettingsInput = { settings: PoolSettings; adminId: string; ipAddress: string | null };

/** Saves the pool settings; the activity log keeps the old and new value of every changed one. */
export async function updatePoolSettings(input: UpdatePoolSettingsInput): Promise<"updated" | "unchanged"> {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(poolSettings).for("update").limit(1);
    const changes: Partial<Record<keyof PoolSettings, { from: unknown; to: unknown }>> = {};
    for (const field of Object.keys(input.settings) as (keyof PoolSettings)[]) {
      if (current[field] !== input.settings[field]) {
        changes[field] = { from: current[field], to: input.settings[field] };
      }
    }
    if (Object.keys(changes).length === 0) {
      return "unchanged";
    }

    await tx.update(poolSettings).set({ ...input.settings, updatedAt: new Date() });
    await recordAudit(tx, {
      actorUserId: input.adminId,
      action: "pool.settings_updated",
      entityType: "pool",
      metadata: { changes },
      ipAddress: input.ipAddress,
    });
    return "updated";
  });
}
