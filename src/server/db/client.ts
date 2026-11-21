import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/server/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Either the root connection or an open transaction, so helpers can join a caller's transaction. */
export type DbExecutor = Database | DbTransaction;

// Kept on globalThis so hot reloads in development don't leak connection pools.
const globalForDb = globalThis as typeof globalThis & {
  databasePool?: Pool;
  database?: Database;
};

/** Lazily connects on first use so builds and tooling never open connections at import time. */
export function getDb(): Database {
  if (!globalForDb.database) {
    globalForDb.databasePool = new Pool({ connectionString: getDatabaseUrl(), max: 10 });
    globalForDb.database = drizzle(globalForDb.databasePool, { schema });
  }
  return globalForDb.database;
}

export async function closeDb(): Promise<void> {
  await globalForDb.databasePool?.end();
  globalForDb.databasePool = undefined;
  globalForDb.database = undefined;
}
