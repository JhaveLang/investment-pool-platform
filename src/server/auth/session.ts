import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/server/db/client";
import { sessions, users, type UserRole } from "@/server/db/schema";
import { isSecureCookieEnabled } from "@/server/env";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "./constants";

/** The narrow user shape exposed to pages and actions (no password hash). */
export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  investorCode: string | null;
  role: UserRole;
};

/** Only the hash is stored, so a database leak doesn't expose usable session tokens. */
function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const db = getDb();

  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  await db.insert(sessions).values({ id: hashSessionToken(token), userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolves the signed-in user once per request (memoised with React `cache`). A deactivated investor counts as signed
 * out, even if a session survived.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const [sessionUser] = await getDb()
    .select({ id: users.id, email: users.email, fullName: users.fullName, investorCode: users.investorCode, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(eq(sessions.id, hashSessionToken(token)), gt(sessions.expiresAt, new Date()), isNull(users.deactivatedAt)),
    )
    .limit(1);

  return sessionUser ?? null;
});

/** The id (token hash) of the current request's session, or `null` when there is no session cookie. */
export async function getCurrentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token ? hashSessionToken(token) : null;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await getDb()
      .delete(sessions)
      .where(eq(sessions.id, hashSessionToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
