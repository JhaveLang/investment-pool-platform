import "server-only";
import { getRedis } from "@/server/redis";

export type RateLimitRule = {
  limit: number;
  windowSeconds: number;
};

export const rateLimitRules = {
  loginPerIp: { limit: 20, windowSeconds: 15 * 60 },
  loginPerEmail: { limit: 5, windowSeconds: 15 * 60 },
  registerPerIp: { limit: 5, windowSeconds: 60 * 60 },
  passwordChangePerUser: { limit: 5, windowSeconds: 15 * 60 },
  moneyMovementPerUser: { limit: 10, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Fixed-window counter in Redis. Fails open when Redis is unreachable so a cache
 * outage never locks investors out; PostgreSQL remains the source of truth.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const redisKey = `rate-limit:${key}`;
  try {
    const results = await getRedis()
      .multi()
      .incr(redisKey)
      .expire(redisKey, rule.windowSeconds, "NX")
      .ttl(redisKey)
      .exec();

    const requestCount = Number(results?.[0]?.[1] ?? 0);
    if (requestCount <= rule.limit) {
      return { allowed: true };
    }
    const secondsUntilReset = Number(results?.[2]?.[1] ?? rule.windowSeconds);
    return { allowed: false, retryAfterSeconds: Math.max(secondsUntilReset, 1) };
  } catch (error) {
    console.error("[rate-limit] Redis unavailable, allowing request", error);
    return { allowed: true };
  }
}

/** Checks several limits (e.g. per IP and per email); the first exceeded one wins. */
export async function consumeRateLimits(
  checks: Array<{ key: string; rule: RateLimitRule }>,
): Promise<RateLimitResult> {
  for (const check of checks) {
    const result = await consumeRateLimit(check.key, check.rule);
    if (!result.allowed) {
      return result;
    }
  }
  return { allowed: true };
}
