"use client";

import { useActionState } from "react";
import { setPromoVisibilityAction } from "@/actions/promos";
import { ConfirmDialog, useConfirmation } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState } from "@/lib/action-state";

export function PromoVisibilityButton({ promoId, name, visible }: { promoId: string; name: string; visible: boolean }) {
  const text = useMessages().admin.promos;
  const [state, action] = useActionState(setPromoVisibilityAction.bind(null, promoId, !visible), idleActionState);
  const { formRef, dialogRef, onSubmit, confirm } = useConfirmation(visible);

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit}>
      <SubmitButton size="sm" variant="secondary" pendingLabel={text.savePending}>
        {visible && <Icon name="eyeOff" className="size-3.5" />}
        {visible ? text.hide : text.show}
      </SubmitButton>
      {visible && (
        <ConfirmDialog
          dialogRef={dialogRef}
          title={text.confirmHide(name)}
          confirmLabel={text.hide}
          cancelLabel={text.cancel}
          onConfirm={confirm}
        >
          {text.hideEffect}
        </ConfirmDialog>
      )}
      {state.status === "error" ? <p role="alert" className="mt-1 text-xs text-loss">{state.message}</p> : null}
    </form>
  );
}
