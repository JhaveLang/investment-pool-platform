"use client";

import { useActionState } from "react";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf, type ActionState } from "@/lib/action-state";

type InvestorProfileFormProps = {
  /** Server Action with the investor id already bound. */
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  fullName: string;
  email: string;
};

export function InvestorProfileForm({ action, fullName, email }: InvestorProfileFormProps) {
  const text = useMessages();
  const [state, formAction] = useActionState(action, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const submitted = submittedValuesOf(state);

  return (
    // Keyed on the saved values so the fields pick up what the server stored after a save.
    <form key={`${fullName}|${email}`} action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <FormField
        name="fullName"
        label={text.admin.investorDetail.fullName}
        autoComplete="off"
        defaultValue={submitted.fullName ?? fullName}
        required
        error={fieldErrors.fullName}
      />
      <FormField
        name="email"
        type="email"
        label={text.profile.email}
        autoComplete="off"
        defaultValue={submitted.email ?? email}
        required
        error={fieldErrors.email}
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel={text.admin.investorDetail.savePending}>
          {text.admin.investorDetail.save}
        </SubmitButton>
      </div>
    </form>
  );
}
