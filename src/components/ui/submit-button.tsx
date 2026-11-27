"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pendingLabel: string;
};

/** Disables itself while the surrounding form's action is running (prevents double submits). */
export function SubmitButton({ children, pendingLabel, disabled, ...buttonProps }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...buttonProps}>
      {pending && <span aria-hidden className="size-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
