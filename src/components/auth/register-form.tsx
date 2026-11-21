"use client";

import { useActionState } from "react";
import { registerAction } from "@/actions/auth";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf } from "@/lib/action-state";

export function RegisterForm() {
  const text = useMessages().auth;
  const [state, formAction] = useActionState(registerAction, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const values = submittedValuesOf(state);

  return (
    <form action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <FormField
        name="fullName"
        label={text.fullName}
        autoComplete="name"
        required
        defaultValue={values.fullName}
        error={fieldErrors.fullName}
      />
      <FormField
        name="email"
        type="email"
        label={text.email}
        autoComplete="email"
        required
        defaultValue={values.email}
        error={fieldErrors.email}
      />
      <FormField
        name="password"
        type="password"
        label={text.password}
        autoComplete="new-password"
        required
        hint={text.passwordHint}
        error={fieldErrors.password}
      />
      <FormField
        name="passwordConfirmation"
        type="password"
        label={text.passwordConfirmation}
        autoComplete="new-password"
        required
        error={fieldErrors.passwordConfirmation}
      />
      <SubmitButton size="lg" className="w-full" pendingLabel={text.registerPending}>
        {text.registerButton}
      </SubmitButton>
    </form>
  );
}
