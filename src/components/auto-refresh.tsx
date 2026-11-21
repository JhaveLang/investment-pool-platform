"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the current page's server data on an interval while the tab is visible,
 * so balances changed by an admin (approvals, reversals) appear without a manual reload.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [router, intervalMs]);

  return null;
}
