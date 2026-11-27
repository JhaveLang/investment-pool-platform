"use client";

import { useActionState } from "react";
import { settlePromoMaturitiesAction } from "@/actions/promos";
import { ActionStateAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState } from "@/lib/action-state";

export function PromoMaturitySettlement() {
  const text = useMessages().admin.promos;
  const [state, action] = useActionState(settlePromoMaturitiesAction, idleActionState);
  return <div className="flex flex-col gap-3">
    <ActionStateAlert state={state} />
    <form action={action}>
      <SubmitButton pendingLabel={text.settlePending}>{text.settleMatured}</SubmitButton>
    </form>
  </div>;
}
