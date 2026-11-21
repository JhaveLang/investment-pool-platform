"use client";

import { useActionState } from "react";
import { inputStyles } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

type ReviewAction = (previousState: ActionState, formData: FormData) => Promise<ActionState>;

type ReviewActionsProps = {
  /** Server Actions with the record id already bound. */
  approveAction: ReviewAction;
  rejectAction: ReviewAction;
  approveLabel: string;
  rejectLabel: string;
  /** Receipt date for reconciling deposits, limited to booking day … today. Only approving uses it. */
  receivedOn?: { defaultValue: string; min: string; max: string };
};

/** Approve / reject controls with an optional note, shared by deposits and withdrawals. */
export function ReviewActions({
  approveAction,
  rejectAction,
  approveLabel,
  rejectLabel,
  receivedOn,
}: ReviewActionsProps) {
  const text = useMessages().admin.review;
  const [approveState, approveFormAction] = useActionState(approveAction, idleActionState);
  const [rejectState, rejectFormAction] = useActionState(rejectAction, idleActionState);
  const failedState = [rejectState, approveState].find((state) => state.status === "error");

  return (
    <form className="flex min-w-60 flex-col gap-2">
      {receivedOn ? (
        <label className="label-caps text-muted">
          {text.receivedOnLabel}
          <input
            type="date"
            name="receivedOn"
            defaultValue={receivedOn.defaultValue}
            min={receivedOn.min}
            max={receivedOn.max}
            className={cn(inputStyles, "mt-1 py-1.5")}
          />
        </label>
      ) : null}
      <input
        name="note"
        maxLength={500}
        aria-label={text.noteLabel}
        placeholder={text.notePlaceholder}
        className={cn(inputStyles, "py-1.5")}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton formAction={approveFormAction} size="sm" className="h-10 flex-1" pendingLabel={text.processing}>
          <Icon name="shieldCheck" className="size-4" />
          {approveLabel}
        </SubmitButton>
        <SubmitButton
          formAction={rejectFormAction}
          size="sm"
          variant="secondary"
          className="h-10 flex-1"
          pendingLabel={text.processing}
        >
          <Icon name="close" className="size-4" />
          {rejectLabel}
        </SubmitButton>
      </div>
      {failedState?.status === "error" ? (
        <p role="alert" className="text-xs text-loss">
          {failedState.message}
        </p>
      ) : null}
    </form>
  );
}
