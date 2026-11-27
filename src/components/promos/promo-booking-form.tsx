"use client";

import { useActionState } from "react";
import { bookPromoAction } from "@/actions/promos";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormatter, useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf } from "@/lib/action-state";

export function PromoBookingForm({ promoId, idempotencyKey, minCents, maxCents }: { promoId: string; idempotencyKey: string; minCents: number; maxCents: number }) {
  const text = useMessages().admin.promos;
  const format = useFormatter();
  const [state, action] = useActionState(bookPromoAction, idleActionState);
  const errors = fieldErrorsOf(state);
  const submitted = submittedValuesOf(state);
  return <form action={action} noValidate className="space-y-4">
    <ActionStateAlert state={state} />
    <input type="hidden" name="promoId" value={promoId} />
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <FormField name="amount" label={text.requestedAmount} inputMode="decimal" required min={format.decimal(minCents)} max={format.decimal(maxCents)} step="1" defaultValue={submitted.amount ?? format.decimal(minCents)} error={errors.amount} />
    <p className="text-sm text-subtle">{text.bookingTerms}</p>
    <SubmitButton pendingLabel={text.requestPending}>{text.requestBooking}</SubmitButton>
  </form>;
}
