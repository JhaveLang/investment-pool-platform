"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/actions/account";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState } from "@/lib/action-state";

export function ChangePasswordForm() {
  const text = useMessages().profile;
  const [state, formAction] = useActionState(changePasswordAction, idleActionState);
  const fieldErrors = fieldErrorsOf(state);

  return (
    // Keyed on success so the password fields are emptied once the change went through.
    <form key={state.status === "success" ? "changed" : "editing"} action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <FormField
        name="currentPassword"
        type="password"
        label={text.currentPassword}
        autoComplete="current-password"
        required
        error={fieldErrors.currentPassword}
      />
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
