"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { Button } from "./button";
import { Icon } from "./icon";

type OneTimeDialogProps = {
  /** Query parameter a redirect set to open the dialog, e.g. `welcome`. */
  param: string;
  title: string;
  description?: string;
  /** Label of the button that just closes the dialog, e.g. "Later". */
  dismissLabel: string;
  /** The main action next to it, e.g. a link. */
  action: ReactNode;
  children: ReactNode;
};

/**
 * A modal that opens by itself, once: the parameter is dropped from the address bar right away, so a refresh doesn't
 * open it again. Native `<dialog>`: closes with Esc, the close button, the dismiss button or a click on the backdrop.
 */
export function OneTimeDialog({ param, title, description, dismissLabel, action, children }: OneTimeDialogProps) {
  const messages = useMessages();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [param]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // The dialog itself is only hit outside its content, i.e. on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface text-left text-fg shadow-[0_24px_48px_-12px_rgba(29,22,33,0.22)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-3">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-xl font-bold tracking-tight text-fg">
            {title}
          </h2>
          {description ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p> : null}
        </div>
        <button
          type="button"
          aria-label={messages.common.close}
          onClick={close}
          className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-highest hover:text-fg"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <div className="px-6 pb-6">
        {children}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {/* The dialog uses the "overlay" surface, so the secondary button takes the next layer up to stay visible. */}
          <Button variant="secondary" onClick={close} className="bg-highest hover:bg-highest/70">
            {dismissLabel}
          </Button>
          {action}
        </div>
      </div>
    </dialog>
  );
}
