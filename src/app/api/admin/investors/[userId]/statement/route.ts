import type { NextRequest } from "next/server";
import { authorizeAdminDownload, csvResponse, textResponse } from "@/server/csv-download";
import { getClientIp } from "@/server/request";
import { exportInvestorStatement } from "@/server/services/investor-statements";

/** GET /api/admin/investors/{id}/statement?from=YYYY-MM&to=YYYY-MM – one investor's monthly statement as CSV. */
export async function GET(request: NextRequest, context: RouteContext<"/api/admin/investors/[userId]/statement">) {
  const authorized = await authorizeAdminDownload(request);
  if ("response" in authorized) {
    return authorized.response;
  }
  const { user, i18n } = authorized;
  const { userId } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  const result = await exportInvestorStatement({
    userId,
    query: { from: searchParams.get("from"), to: searchParams.get("to") },
    i18n,
    adminUserId: user.id,
    ipAddress: await getClientIp(),
  });
  if (result === "not-found") {
    return textResponse(i18n.messages.errors.notFoundTitle, 404);
  }
  if (result === "invalid-range") {
    return textResponse(i18n.messages.validation.invalidRequest, 400);
  }
  return csvResponse(result);
}
