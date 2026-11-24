"use client";

import { useActionState } from "react";
import { createInvestorAction } from "@/actions/account";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf } from "@/lib/action-state";

/** Admin form for a new investor; on success the action opens the investor's detail page. */
export function CreateInvestorForm() {
  const messages = useMessages();
  const text = messages.admin.investorCreate;
  const [state, formAction] = useActionState(createInvestorAction, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const values = submittedValuesOf(state);

  return (
    <form action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <FormField
        name="fullName"
        label={messages.admin.investorDetail.fullName}
        autoComplete="off"
        required
        defaultValue={values.fullName}
        error={fieldErrors.fullName}
      />
      <FormField
        name="email"
        type="email"
        label={messages.profile.email}
        autoComplete="off"
        required
        defaultValue={values.email}
        error={fieldErrors.email}
      />
      <FormField
        name="investorCode"
        label={messages.columns.investorId}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        className="max-w-48"
        defaultValue={values.investorCode}
        hint={text.investorCodeHint}
        error={fieldErrors.investorCode}
      />
      <FormField
        name="password"
        type="password"
        label={text.password}
        autoComplete="new-password"
        required
        hint={messages.auth.passwordHint}
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
      <div className="flex justify-end">
        <SubmitButton pendingLabel={text.submitPending}>{text.submit}</SubmitButton>
      </div>
    </form>
  );
}
