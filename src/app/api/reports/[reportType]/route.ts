import type { NextRequest } from "next/server";
import { getSchemas } from "@/lib/validation";
import { authorizeAdminDownload, csvResponse, textResponse } from "@/server/csv-download";
import { getClientIp } from "@/server/request";
import { exportReport, isReportType } from "@/server/services/reports";

/** GET /api/reports/{transactions|deposits|withdrawals|balances}?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest, context: RouteContext<"/api/reports/[reportType]">) {
  const authorized = await authorizeAdminDownload(request);
  if ("response" in authorized) {
    return authorized.response;
  }
  const { user, i18n } = authorized;

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

  return csvResponse(report);
}
