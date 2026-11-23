import type { NextRequest } from "next/server";
import { parseChoiceParam } from "@/lib/pagination";
import { authorizeAdminDownload, csvResponse, textResponse } from "@/server/csv-download";
import { INVESTOR_LIST_FILTERS } from "@/server/queries/admin";
import { getClientIp } from "@/server/request";
import { exportInvestorStatements } from "@/server/services/investor-statements";

const MAX_SEARCH_LENGTH = 100;

/**
 * GET /api/admin/investors/statements?from=YYYY-MM&to=YYYY-MM&status=…&q=… – the monthly statement of every
 * investor in the investor list's filter (same status and search rules as the list), as CSV.
 */
export async function GET(request: NextRequest) {
  const authorized = await authorizeAdminDownload(request);
  if ("response" in authorized) {
    return authorized.response;
  }
  const { user, i18n } = authorized;
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  const status = parseChoiceParam(searchParams.get("status") ?? undefined, INVESTOR_LIST_FILTERS, "all");

  const result = await exportInvestorStatements({
    query: { from: searchParams.get("from"), to: searchParams.get("to") },
    status,
    search,
    i18n,
    adminUserId: user.id,
    ipAddress: await getClientIp(),
  });
  if (typeof result === "string") {
    return textResponse(i18n.messages.validation.invalidRequest, 400);
  }
  return csvResponse(result);
}
