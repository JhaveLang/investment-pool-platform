import "server-only";
import type { NextRequest } from "next/server";

/** Comment lines keep proxies and load balancers from closing an idle stream. */
const HEARTBEAT_MS = 25_000;
/** The browser reconnects on its own after this, which checks the session again. */
const STREAM_LIFETIME_MS = 4 * 60_000;
const RECONNECT_DELAY_MS = 3_000;

function parseEventId(value: string | null): number | null {
  const id = Number(value);
  return value !== null && value !== "" && Number.isSafeInteger(id) && id >= 0 ? id : null;
}

type NotificationStreamOptions<Event extends { id: number }> = {
  request: NextRequest;
  /** Starts live delivery for this stream; returns the unsubscribe function. */
  subscribe: (listener: (event: Event) => void) => Promise<() => void>;
  /** Events logged after `afterId`, newest first. */
  replay: (afterId: number) => Promise<Event[]>;
};

/**
 * A Server-Sent Events response carrying live events (`event: notification`, the activity-log id as event id).
 * Events logged after `?after=<id>` (or after the browser's `Last-Event-ID` when it reconnects) are replayed first, so
 * nothing is lost between rendering the page and opening the stream. The caller checks who may listen.
 */
export function notificationStream<Event extends { id: number }>({
  request,
  subscribe,
  replay,
}: NotificationStreamOptions<Event>): Response {
  const afterId =
    parseEventId(request.headers.get("last-event-id")) ?? parseEventId(request.nextUrl.searchParams.get("after"));
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastSentId = afterId ?? 0;
      let replaying = true;
      const heldBack: Event[] = [];

      const send = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };
      const sendEvent = (event: Event) => {
        if (event.id > lastSentId) {
          lastSentId = event.id;
          send(`id: ${event.id}\nevent: notification\ndata: ${JSON.stringify(event)}\n\n`);
        }
      };
      const close = () => {
        if (!closed) {
          cleanup();
          closed = true;
          controller.close();
        }
      };

      // Subscribe before replaying, so an event committed in between is held back instead of lost.
      let unsubscribe: () => void;
      try {
        unsubscribe = await subscribe((event) => (replaying ? heldBack.push(event) : sendEvent(event)));
      } catch (error) {
        console.error("[notifications] Stream could not subscribe", error);
        controller.error(error);
        return;
      }
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      const lifetime = setTimeout(close, STREAM_LIFETIME_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        unsubscribe();
        request.signal.removeEventListener("abort", close);
        cleanup = () => {};
      };
      request.signal.addEventListener("abort", close);

      send(`retry: ${RECONNECT_DELAY_MS}\n\n`);
      try {
        if (afterId !== null) {
          (await replay(afterId)).reverse().forEach(sendEvent);
        }
      } catch (error) {
        console.error("[notifications] Replay failed", error);
      }
      replaying = false;
      heldBack.sort((left, right) => left.id - right.id).forEach(sendEvent);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // `no-transform` keeps compression from holding small events back.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
