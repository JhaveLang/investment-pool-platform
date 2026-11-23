import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getI18n, type I18n } from "@/i18n/server";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";

export const textResponse = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * The signed-in admin of a CSV download, or the response to send instead: back to the login page when the session
 * has expired (the download is a plain link or form), 403 for investors.
 */
export async function authorizeAdminDownload(
  request: NextRequest,
): Promise<{ user: SessionUser; i18n: I18n } | { response: Response }> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.redirect(new URL("/login", request.url)) };
  }
  const i18n = await getI18n();
  if (user.role !== "admin") {
    return { response: textResponse(i18n.messages.errors.forbidden, 403) };
  }
  return { user, i18n };
}

export function csvResponse({ fileName, csv }: { fileName: string; csv: string }): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
