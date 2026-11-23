import type { NextRequest } from "next/server";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { notificationStream } from "@/server/notification-stream";
import { subscribeToAdminNotifications } from "@/server/notifications";
import { listAdminNotifications } from "@/server/queries/notifications";

const REPLAY_LIMIT = 20;

/** GET /api/admin/notifications?after=<id>: live admin notifications (new withdrawal requests, deposits, registrations). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(null, { status: 401 });
  }
  if (user.role !== "admin") {
    const { messages } = await getI18n();
    return new Response(messages.errors.forbidden, { status: 403 });
  }
  return notificationStream({
    request,
    subscribe: subscribeToAdminNotifications,
    replay: (afterId) => listAdminNotifications({ limit: REPLAY_LIMIT, afterId }),
  });
}
