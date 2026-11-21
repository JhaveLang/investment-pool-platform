"use client";

import { useActionState } from "react";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, type ActionState } from "@/lib/action-state";

type InvestorPasswordFormProps = {
  /** Server Action with the investor id already bound. */
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
};

export function InvestorPasswordForm({ action }: InvestorPasswordFormProps) {
  const text = useMessages().admin.investorDetail;
  const [state, formAction] = useActionState(action, idleActionState);
  const fieldErrors = fieldErrorsOf(state);

  return (
    // Keyed on success so the password fields are emptied once the new password is set.
    <form key={state.status === "success" ? "set" : "editing"} action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <FormField
        name="newPassword"
        type="password"
        label={text.newPassword}
        autoComplete="new-password"
        required
        error={fieldErrors.newPassword}
      />
      <FormField
        name="newPasswordConfirmation"
        type="password"
        label={text.newPasswordConfirmation}
        autoComplete="new-password"
        required
        error={fieldErrors.newPasswordConfirmation}
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel={text.savePending}>{text.save}</SubmitButton>
      </div>
    </form>
  );
}
