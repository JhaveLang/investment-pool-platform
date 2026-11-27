"use client";

import { useActionState, useEffect, useState } from "react";
import { savePromoEditsAction } from "@/actions/promos";
import { ActionStateAlert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { FormField, TextAreaField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Popup } from "@/components/ui/popup";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormatter, useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf, type ActionState } from "@/lib/action-state";
import { MAX_PROMO_DETAILS_LENGTH } from "@/lib/promo";

type OfferInitial = {
  name: string;
  bookingUntil: string;
  minDepositCents: number;
  maxDepositCents: number;
  termMonths: number;
  totalReturnBps: number;
  details: string;
  isExample: boolean;
  visible: boolean;
};

type Props = {
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  initial: OfferInitial;
  submitLabel: string;
  onCancel?: () => void;
  onSaved?: (message: string) => void;
};

export function PromoForm({ action, initial, submitLabel, onCancel, onSaved }: Props) {
  const text = useMessages().admin.promos;
  const format = useFormatter();
  const [state, formAction, pending] = useActionState(action, idleActionState);
  useEffect(() => {
    if (state.status === "success") onSaved?.(state.message);
  }, [state, onSaved]);
  const errors = fieldErrorsOf(state);
  const submitted = submittedValuesOf(state);
  const failed = state.status === "error" && state.values !== undefined;
  const value = (name: string, fallback: string | number) => failed ? (submitted[name] ?? "") : fallback;

  return (
    <form action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <FormField name="name" label={text.name} required maxLength={100} defaultValue={value("name", initial.name)} error={errors.name} />
      <FormField name="bookingUntil" type="date" label={text.bookingUntil} required defaultValue={value("bookingUntil", initial.bookingUntil)} error={errors.bookingUntil} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="minDeposit" label={text.minDeposit} inputMode="decimal" required defaultValue={value("minDeposit", format.decimal(initial.minDepositCents))} error={errors.minDeposit} />
        <FormField name="maxDeposit" label={text.maxDeposit} inputMode="decimal" required defaultValue={value("maxDeposit", format.decimal(initial.maxDepositCents))} error={errors.maxDeposit} />
        <FormField name="termMonths" label={text.termMonths} type="number" min={1} max={120} step={1} required defaultValue={value("termMonths", initial.termMonths)} error={errors.termMonths} />
        <FormField name="totalReturn" label={text.totalReturn} inputMode="decimal" required defaultValue={value("totalReturn", format.decimal(initial.totalReturnBps))} error={errors.totalReturn} />
      </div>
      <TextAreaField name="details" label={text.details} rows={7} maxLength={MAX_PROMO_DETAILS_LENGTH} defaultValue={value("details", initial.details)} error={errors.details} />
      <label className="flex items-start gap-3 text-sm text-fg">
        <input type="checkbox" name="isExample" defaultChecked={failed ? submitted.isExample === "on" : initial.isExample} className="mt-0.5 size-4 shrink-0 accent-accent-400" />
        <span>{text.exampleOnly}<span className="mt-0.5 block text-[13px] text-subtle">{text.exampleOnlyHint}</span></span>
      </label>
      <label className="flex items-start gap-3 text-sm text-fg">
        <input type="checkbox" name="visible" defaultChecked={failed ? submitted.visible === "on" : initial.visible} className="mt-0.5 size-4 shrink-0 accent-accent-400" />
        <span>{text.visible}<span className="mt-0.5 block text-[13px] text-subtle">{text.visibleHint}</span></span>
      </label>
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={pending}>{text.cancel}</Button>}
        <SubmitButton pendingLabel={text.savePending}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function EditPromoButton({ offer }: { offer: OfferInitial & { id: string } }) {
  const text = useMessages().admin.promos;
  const [savedMessage, setSavedMessage] = useState("");

  return (
    <div>
      <Popup
        title={text.editTitle}
        description={offer.name}
        trigger={<><Icon name="pencil" className="size-3.5" />{text.edit}</>}
        triggerClassName={buttonStyles({ variant: "secondary", size: "sm" })}
      >
        {(close) => (
          <PromoForm
            action={savePromoEditsAction.bind(null, offer.id)}
            initial={offer}
            submitLabel={text.save}
            onCancel={close}
            onSaved={(message) => {
              setSavedMessage(message);
              close();
            }}
          />
        )}
      </Popup>
      <p role="status" className="max-w-40 text-xs text-gain empty:hidden">{savedMessage}</p>
    </div>
  );
}
