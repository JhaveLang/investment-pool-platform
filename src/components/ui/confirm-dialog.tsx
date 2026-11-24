"use client";

import { useId, useRef, type FormEvent, type ReactNode, type RefObject } from "react";
import { Button } from "./button";

/**
 * Holds a form's submission back until the user confirms it in a `ConfirmDialog`. Every way of submitting is caught
 * (button, Enter in a field), because the check runs in `onSubmit`, which also stops React's form action.
 * With `required` false the form submits as usual.
 */
export function useConfirmation(required: boolean) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmedRef = useRef(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!required || confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }
    event.preventDefault();
    dialogRef.current?.showModal();
  };

  const confirm = () => {
    confirmedRef.current = true;
    dialogRef.current?.close();
    formRef.current?.requestSubmit();
  };

  return { formRef, dialogRef, onSubmit, confirm };
}

type ConfirmDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
};

/**
 * A modal question with Cancel and a red confirm button (native `<dialog>`: focus stays inside, Esc cancels).
 * Cancel has the focus, so pressing Enter by accident changes nothing.
 */
export function ConfirmDialog({
  dialogRef,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-left text-fg shadow-[0_24px_48px_-12px_rgba(29,22,33,0.22)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight text-fg">
        {title}
      </h2>
      <div id={descriptionId} className="mt-2 text-sm leading-relaxed whitespace-normal text-muted">
        {children}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" autoFocus onClick={() => dialogRef.current?.close()}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
