"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";

/**
 * The avatar opens a small panel with language and sign-out on phones, where the top bar
 * has no room for them. A native <details>, closed again on every route change.
 */
export function AccountMenu({ avatar, children }: { avatar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const messages = useMessages();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    detailsRef.current?.removeAttribute("open");
  }, [pathname]);

  return (
    <details ref={detailsRef} className="group relative">
      <summary
        aria-label={messages.nav.accountMenu}
        className="cursor-pointer list-none rounded-full [&::-webkit-details-marker]:hidden"
      >
        {avatar}
      </summary>
      <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-overlay p-3 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.6)]">
        {children}
      </div>
    </details>
  );
}
