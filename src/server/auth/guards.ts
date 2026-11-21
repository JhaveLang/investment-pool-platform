import "server-only";
import { redirect } from "next/navigation";
import type { UserRole } from "@/server/db/schema";
import { getCurrentUser, type SessionUser } from "./session";

export function homePathForRole(role: UserRole): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

export function profilePathForRole(role: UserRole): string {
  return role === "admin" ? "/admin/profile" : "/profile";
}

/**
 * Authorization guards. Call one at the top of every page, Server Action and
 * Route Handler: layouts and the proxy alone are not a security boundary.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireInvestor(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "investor") {
    redirect(homePathForRole(user.role));
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect(homePathForRole(user.role));
  }
  return user;
}
