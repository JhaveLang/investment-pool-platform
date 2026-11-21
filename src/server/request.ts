import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting and the activity log. Relies on the reverse
 * proxy (nginx, Caddy, load balancer) setting X-Forwarded-For in production.
 */
export async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || requestHeaders.get("x-real-ip") || null;
}
