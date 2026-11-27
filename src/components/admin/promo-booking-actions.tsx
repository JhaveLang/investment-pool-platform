"use client";

import { useActionState } from "react";
import { markPromoConfirmationSentAction, processReadyPromoBookingsAction, settlePromoBookingMaturitiesAction } from "@/actions/promos";
import { ActionStateAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState } from "@/lib/action-state";

export function ProcessPromoBookings() {
  const text = useMessages().admin.promos;
  const [state, action] = useActionState(processReadyPromoBookingsAction, idleActionState);
  return <div className="space-y-2"><ActionStateAlert state={state} /><form action={action}><SubmitButton pendingLabel={text.processing}>{text.processReady}</SubmitButton></form></div>;
}

export function SettlePromoBookings() {
  const text = useMessages().admin.promos;
  const [state, action] = useActionState(settlePromoBookingMaturitiesAction, idleActionState);
  return <div className="space-y-2"><ActionStateAlert state={state} /><form action={action}><SubmitButton pendingLabel={text.settlePending}>{text.settleMatured}</SubmitButton></form></div>;
}

export function MarkPromoConfirmationSent({ bookingId }: { bookingId: string }) {
  const text = useMessages().admin.promos;
  const [state, action] = useActionState(markPromoConfirmationSentAction.bind(null, bookingId), idleActionState);
  return <form action={action}><SubmitButton size="sm" variant="secondary" pendingLabel={text.processing}>{text.confirmationSent}</SubmitButton>{state.status === "error" ? <p role="alert" className="text-xs text-loss">{state.message}</p> : null}</form>;
}
