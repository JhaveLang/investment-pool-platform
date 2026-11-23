"use client";

import { useEffect, useRef, useState } from "react";

export type ConnectionStatus = "connecting" | "live" | "offline";

/**
 * Keeps a Server-Sent Events stream open while the component is mounted and calls `onEvent` for every `notification`
 * event. The browser reconnects on its own (replaying from the last event id); `offline` means it gave up, e.g. after
 * the session ended.
 */
export function useEventStream<Event>(url: string, onEvent: (event: Event) => void): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const source = new EventSource(url);
    source.onopen = () => setStatus("live");
    source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
    source.addEventListener("notification", (message) => {
      onEventRef.current(JSON.parse((message as MessageEvent<string>).data) as Event);
    });
    return () => source.close();
  }, [url]);

  return status;
}

const MAX_TOASTS = 3;
const TOAST_MS = 6_000;

/** The newest few events as toasts, newest first, each removed again after a few seconds or when dismissed. */
export function useToasts<Item extends { id: number }>() {
  const [toasts, setToasts] = useState<Item[]>([]);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const dismiss = (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id));
  const show = (item: Item) => {
    setToasts((current) => [item, ...current.filter((toast) => toast.id !== item.id)].slice(0, MAX_TOASTS));
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      dismiss(item.id);
    }, TOAST_MS);
    timers.current.add(timer);
  };

  return { toasts, show, dismiss };
}
