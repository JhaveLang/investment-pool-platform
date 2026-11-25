"use client";

import { useActionState, type ReactNode } from "react";
import { updatePoolSettingsAction } from "@/actions/pool-settings";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField, TextAreaField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormatter, useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf } from "@/lib/action-state";
import {
  HIGHEST_WITHDRAWAL_MIN_CENTS,
  LOWEST_WITHDRAWAL_MAX_CENTS,
  MAX_POOL_NOTICE_LENGTH,
  type PoolSettings,
} from "@/lib/pool-settings";

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="font-display text-[15px] font-semibold text-fg">
        {title}
      </p>
      <p className="mt-1 mb-4 max-w-prose text-[13px] text-subtle">{hint}</p>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Whether and when the pool takes deposits, the limits per request, and the notice above the investors' forms. */
export function PoolSettingsForm({ settings }: { settings: PoolSettings }) {
  const text = useMessages().admin.pool;
  const format = useFormatter();
  const [state, formAction] = useActionState(updatePoolSettingsAction, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const submitted = submittedValuesOf(state);
  // After a failed save the form shows what was submitted, otherwise the saved settings.
  const failed = state.status === "error" && state.values !== undefined;

  const amountField = (name: string, label: string, cents: number) => (
    <FormField
      name={name}
      label={label}
      inputMode="decimal"
      autoComplete="off"
      required
      defaultValue={failed ? submitted[name] : format.decimal(cents)}
      error={fieldErrors[name]}
    />
  );
  const dateField = (name: "depositsFrom" | "depositsUntil", label: string) => (
    <FormField
      name={name}
      type="date"
      label={label}
      defaultValue={failed ? submitted[name] : (settings[name] ?? "")}
      error={fieldErrors[name]}
    />
  );
  const noticeField = (name: "noticeDe" | "noticeEn", label: string) => (
    <TextAreaField
      name={name}
      label={label}
      rows={3}
      maxLength={MAX_POOL_NOTICE_LENGTH}
      defaultValue={failed ? submitted[name] : (settings[name] ?? "")}
      error={fieldErrors[name]}
    />
  );

  return (
    <form action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <label className="flex items-start gap-3 text-sm text-fg">
        <input
          type="checkbox"
          name="depositsOpen"
          defaultChecked={failed ? submitted.depositsOpen === "on" : settings.depositsOpen}
          className="mt-0.5 size-4 shrink-0 accent-accent-400"
        />
        <span>
          {text.depositsOpenLabel}
          <span className="mt-0.5 block max-w-prose text-[13px] text-subtle">{text.depositsOpenHint}</span>
        </span>
      </label>
      <Section title={text.depositDates} hint={text.depositDatesHint}>
        {dateField("depositsFrom", text.firstDay)}
        {dateField("depositsUntil", text.lastDay)}
      </Section>
      <Section title={text.depositLimits} hint={text.depositHint}>
        {amountField("depositMin", text.minimum, settings.depositMinCents)}
        {amountField("depositMax", text.maximum, settings.depositMaxCents)}
      </Section>
      <Section
        title={text.withdrawalLimits}
        hint={text.withdrawalHint(
          format.currency(HIGHEST_WITHDRAWAL_MIN_CENTS),
          format.currency(LOWEST_WITHDRAWAL_MAX_CENTS),
        )}
      >
        {amountField("withdrawalMin", text.minimum, settings.withdrawalMinCents)}
        {amountField("withdrawalMax", text.maximum, settings.withdrawalMaxCents)}
      </Section>
      <Section title={text.notices} hint={text.noticesHint}>
        {noticeField("noticeDe", text.noticeDe)}
        {noticeField("noticeEn", text.noticeEn)}
      </Section>
      <div className="flex justify-end">
        <SubmitButton pendingLabel={text.savePending}>{text.save}</SubmitButton>
      </div>
    </form>
  );
}
