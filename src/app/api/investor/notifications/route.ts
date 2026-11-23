import type { NextRequest } from "next/server";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { notificationStream } from "@/server/notification-stream";
import { subscribeToInvestorNotifications } from "@/server/notifications";
import { listInvestorNotifications } from "@/server/queries/notifications";

const REPLAY_LIMIT = 20;

/**
 * GET /api/investor/notifications?after=<id>: live updates for the signed-in investor only (deposit reconciled or
 * cancelled, withdrawal approved or rejected, monthly return booked). The investor comes from the session, never
 * from the request.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(null, { status: 401 });
  }
  if (user.role !== "investor") {
    const { messages } = await getI18n();
    return new Response(messages.errors.forbidden, { status: 403 });
  }
  return notificationStream({
    request,
    subscribe: (listener) => subscribeToInvestorNotifications(user.id, listener),
    replay: (afterId) => listInvestorNotifications({ userId: user.id, afterId, limit: REPLAY_LIMIT }),
  });
}
