"use client";

import { useEffect, type ReactNode } from "react";
import { Alert } from "./alert";

type FlashAlertProps = {
  /** Query parameter a redirect set to trigger the alert, e.g. `created`. */
  param: string;
  children: ReactNode;
  className?: string;
};

/**
 * Success alert for a one-time query parameter. The parameter is dropped from the address bar at once (Next.js keeps
 * its router in sync), so a later refresh or form action on the same page doesn't show the alert again.
 */
export function FlashAlert({ param, children, className }: FlashAlertProps) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [param]);

  return (
    <Alert tone="success" className={className}>
      {children}
    </Alert>
  );
}
