"use client";

import { useActionState } from "react";
import { ConfirmDialog, useConfirmation } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState, type ActionState } from "@/lib/action-state";

type InvestorStatusButtonProps = {
  /** Server Action with the investor id already bound. */
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  /** The investor's current status; the button switches to the other one. */
  active: boolean;
  investorName: string;
};

/**
 * Deactivate / activate straight from the investor list (no note; the detail page offers one). Deactivating asks for
 * confirmation first. The list reloads afterwards, so the row shows the new status or, in a filtered view, leaves it.
 */
export function InvestorStatusButton({ action, active, investorName }: InvestorStatusButtonProps) {
  const messages = useMessages();
  const text = messages.admin;
  const [state, formAction] = useActionState(action, idleActionState);
  const { formRef, dialogRef, onSubmit: holdForConfirmation, confirm } = useConfirmation(active);

  return (
    <form ref={formRef} action={formAction} onSubmit={holdForConfirmation} className="flex flex-col items-start gap-1">
      <input type="hidden" name="status" value={active ? "deactivated" : "active"} />
      <SubmitButton
        size="sm"
        variant={active ? "danger" : "secondary"}
        pendingLabel={text.investorDetail.savePending}
        aria-label={
          active
            ? text.investorActions.deactivateInvestor(investorName)
            : text.investorActions.activateInvestor(investorName)
        }
        title={active ? text.investorDetail.deactivate : text.investorDetail.activate}
        className="min-w-8 px-0 aria-busy:px-3"
      >
        <Icon name={active ? "lock" : "unlock"} className="size-4" />
      </SubmitButton>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-loss">
          {state.message}
        </p>
      ) : null}
      <ConfirmDialog
        dialogRef={dialogRef}
        title={text.investorDetail.confirmDeactivateTitle}
        confirmLabel={text.investorDetail.deactivate}
        cancelLabel={text.investorDetail.cancel}
        onConfirm={confirm}
      >
        {text.investorDetail.confirmDeactivateBody(investorName)}
      </ConfirmDialog>
    </form>
  );
}
