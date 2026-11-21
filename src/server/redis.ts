import Redis from "ioredis";
import { getRedisUrl } from "@/server/env";

const globalForRedis = globalThis as typeof globalThis & { redisClient?: Redis };

/** Lazily created shared client; fails fast so a Redis outage never blocks requests for long. */
export function getRedis(): Redis {
  if (!globalForRedis.redisClient) {
    const client = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
    });
    client.on("error", (error) => console.error("[redis]", error.message));
    globalForRedis.redisClient = client;
  }
  return globalForRedis.redisClient;
}
