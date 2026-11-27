import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

/**
 * Optimistic check only: visitors without a session cookie are sent to the login page
 * before any rendering happens. Pages, Server Actions and Route Handlers still verify
 * the session against the database themselves (see `server/auth/guards.ts`).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/deposit/:path*",
    "/withdraw/:path*",
    "/promos/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};
