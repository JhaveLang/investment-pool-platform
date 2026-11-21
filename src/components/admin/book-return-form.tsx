"use client";

import { useActionState } from "react";
import { bookMonthlyReturnAction } from "@/actions/admin";
import { ActionStateAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState } from "@/lib/action-state";

type BookReturnFormProps = {
  month: string;
  /** The rate exactly as entered for the preview; the action parses it again. */
  rate: string;
  expectedTotalCents: number;
  submitLabel: string;
};

/** Confirms a previewed month. On success the action redirects back to the overview. */
export function BookReturnForm({ month, rate, expectedTotalCents, submitLabel }: BookReturnFormProps) {
  const text = useMessages().admin;
  const [state, formAction] = useActionState(bookMonthlyReturnAction, idleActionState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="rate" value={rate} />
      <input type="hidden" name="expectedTotalCents" value={expectedTotalCents} />
      <ActionStateAlert state={state} />
      <p className="text-sm text-subtle">{text.returnsBookHint}</p>
      <SubmitButton pendingLabel={text.returnsBookPending}>{submitLabel}</SubmitButton>
    </form>
  );
}
