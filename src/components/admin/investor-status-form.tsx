"use client";

import { useActionState } from "react";
import { ActionStateAlert } from "@/components/ui/alert";
import { inputStyles, labelStyles } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState, type ActionState } from "@/lib/action-state";

type InvestorStatusFormProps = {
  /** Server Action with the investor id already bound. */
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  /** The investor's current status; the button switches to the other one. */
  active: boolean;
};

/** Deactivate or activate button with an optional note for the activity log. */
export function InvestorStatusForm({ action, active }: InvestorStatusFormProps) {
  const messages = useMessages();
  const text = messages.admin.investorDetail;
  const [state, formAction] = useActionState(action, idleActionState);

  return (
    <div className="space-y-5">
      {/* Outside the keyed form, so the outcome stays visible once the card flips to the other status. */}
      <ActionStateAlert state={state} />
      <form key={active ? "active" : "deactivated"} action={formAction} noValidate className="space-y-5">
        <input type="hidden" name="status" value={active ? "deactivated" : "active"} />
        <div>
          <label htmlFor="field-status-note" className={labelStyles}>
            {messages.admin.review.noteLabel}
          </label>
          <input
            id="field-status-note"
            name="note"
            maxLength={500}
            placeholder={messages.admin.review.notePlaceholder}
            className={inputStyles}
          />
        </div>
        <div className="flex justify-end">
          <SubmitButton variant={active ? "danger" : "primary"} pendingLabel={text.savePending}>
            <Icon name={active ? "lock" : "unlock"} className="size-4" />
            {active ? text.deactivate : text.activate}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
