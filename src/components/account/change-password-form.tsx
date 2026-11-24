"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/actions/account";
import { ActionStateAlert } from "@/components/ui/alert";
import { PasswordField } from "@/components/ui/password-field";
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
      <PasswordField
        name="currentPassword"
        label={text.currentPassword}
        autoComplete="current-password"
        required
        error={fieldErrors.currentPassword}
      />
      <PasswordField
        name="newPassword"
        label={text.newPassword}
        autoComplete="new-password"
        required
        error={fieldErrors.newPassword}
      />
      <PasswordField
        name="newPasswordConfirmation"
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
