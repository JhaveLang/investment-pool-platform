import "server-only";
import { getDb, type DbExecutor } from "@/server/db/client";
import { poolSettings, type PoolSettingsRow } from "@/server/db/schema";

/** The pool's one settings row (created by its migration). */
export async function getPoolSettings(executor: DbExecutor = getDb()): Promise<PoolSettingsRow> {
  const [settings] = await executor.select().from(poolSettings).limit(1);
  return settings;
}
