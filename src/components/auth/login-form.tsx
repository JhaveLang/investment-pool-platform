"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf } from "@/lib/action-state";

export function LoginForm() {
  const text = useMessages().auth;
  const [state, formAction] = useActionState(loginAction, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const values = submittedValuesOf(state);

  return (
    // noValidate: the server returns localised messages instead of browser-language popups.
    <form action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
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
        autoComplete="current-password"
        required
        error={fieldErrors.password}
      />
      <SubmitButton size="lg" className="w-full" pendingLabel={text.loginPending}>
        {text.loginButton}
      </SubmitButton>
    </form>
  );
}
