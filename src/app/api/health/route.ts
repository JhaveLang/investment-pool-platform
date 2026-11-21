import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { getRedis } from "@/server/redis";

/** Liveness/readiness probe for Docker and load balancers. Redis is optional (rate limiting fails open). */
export async function GET() {
  const [database, redis] = await Promise.all([
    getDb()
      .execute(sql`select 1`)
      .then(() => "up" as const)
      .catch(() => "down" as const),
    getRedis()
      .ping()
      .then(() => "up" as const)
      .catch(() => "down" as const),
  ]);

  const status = database === "up" ? "ok" : "error";
  return Response.json(
    { status, database, redis },
    { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
