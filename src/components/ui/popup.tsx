"use client";

import { useId, useRef, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { buttonStyles } from "./button";
import { Icon } from "./icon";

const sizeStyles = {
  md: "w-[min(34rem,calc(100vw-2rem))]",
  /** For a grid of cards. */
  wide: "w-[min(76rem,calc(100vw-2rem))]",
} as const;

// Fades and scales in on opening and out on closing (`@starting-style` plus discrete transitions of display and the
// top layer); the backdrop fades with it. Without motion it simply appears.
const motionStyles = cn(
  "scale-95 opacity-0 transition-[opacity,scale,overlay,display] transition-discrete duration-200 ease-out",
  "open:scale-100 open:opacity-100 starting:open:scale-95 starting:open:opacity-0",
  "backdrop:bg-black/0 backdrop:transition-[background-color,overlay,display] backdrop:transition-discrete backdrop:duration-200",
  "open:backdrop:bg-black/40 starting:open:backdrop:bg-black/0",
  "motion-reduce:transition-none motion-reduce:backdrop:transition-none",
);

type PopupProps = {
  title: string;
  description?: string;
  /** Content of the button that opens the popup. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Accessible name of the button, when its content alone doesn't say what it opens. */
  triggerLabel?: string;
  /** Tooltip of the button. */
  triggerTitle?: string;
  /** Close once a form inside is submitted, e.g. a download that keeps the page open. */
  closeOnSubmit?: boolean;
  size?: keyof typeof sizeStyles;
  children: ReactNode;
};

/**
 * A button that opens a modal with more content (native `<dialog>`: it sits above scrolling tables and pinned
 * columns, keeps the focus inside, and closes with Esc, the close button or a click on the backdrop). Content that is
 * taller than the screen scrolls inside it.
 */
export function Popup({
  title,
  description,
  trigger,
  triggerClassName,
  triggerLabel,
  triggerTitle,
  closeOnSubmit = false,
  size = "md",
  children,
}: PopupProps) {
  const messages = useMessages();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        title={triggerTitle}
        onClick={() => dialogRef.current?.showModal()}
        className={triggerClassName ?? buttonStyles({ variant: "secondary" })}
      >
        {trigger}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // The dialog itself is only hit outside its content, i.e. on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            close();
          }
        }}
        onSubmit={closeOnSubmit ? close : undefined}
        className={cn(
          "m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface text-left whitespace-normal text-fg shadow-[0_24px_48px_-12px_rgba(29,22,33,0.22)] backdrop:backdrop-blur-sm",
          sizeStyles[size],
          motionStyles,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            aria-label={messages.common.close}
            onClick={close}
            className={buttonStyles({ variant: "ghost", size: "iconSm", className: "-mt-1 -mr-1" })}
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </dialog>
    </>
  );
}
