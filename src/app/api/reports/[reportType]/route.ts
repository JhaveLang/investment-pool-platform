import { NextResponse, type NextRequest } from "next/server";
import { getI18n } from "@/i18n/server";
import { getSchemas } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { getClientIp } from "@/server/request";
import { exportReport, isReportType } from "@/server/services/reports";

const textResponse = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** GET /api/reports/{transactions|deposits|withdrawals|balances}?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest, context: RouteContext<"/api/reports/[reportType]">) {
  const user = await getCurrentUser();
  if (!user) {
    // Expired session: send the admin back to the login page instead of an error.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const i18n = await getI18n();
  if (user.role !== "admin") {
    return textResponse(i18n.messages.errors.forbidden, 403);
  }

  const { reportType } = await context.params;
  if (!isReportType(reportType)) {
    return textResponse(i18n.messages.errors.notFoundTitle, 404);
  }

  const searchParams = request.nextUrl.searchParams;
  const parsedRange = getSchemas(i18n.locale).reportRangeSchema.safeParse({
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  });
  if (!parsedRange.success) {
    return textResponse(i18n.messages.validation.invalidRequest, 400);
  }

  const report = await exportReport({
    reportType,
    range: parsedRange.data,
    i18n,
    adminUserId: user.id,
    ipAddress: await getClientIp(),
  });

  return new Response(report.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
