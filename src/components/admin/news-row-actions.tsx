"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { ConfirmDialog, useConfirmation } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { idleActionState, type ActionState } from "@/lib/action-state";

type NewsRowActionsProps = {
  newsId: string;
  visible: boolean;
  /** Date and German text, shown in the delete confirmation. */
  summary: string;
  /** Server Actions with the notice id (and, for the toggle, the new visibility) already bound. */
  toggleAction: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
};

/** Edit, hide / show and delete for one notice in the admin list; deleting asks for confirmation first. */
export function NewsRowActions({ newsId, visible, summary, toggleAction, deleteAction }: NewsRowActionsProps) {
  const text = useMessages().admin.news;
  const [toggleState, toggleFormAction] = useActionState(toggleAction, idleActionState);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, idleActionState);
  const { formRef, dialogRef, onSubmit: holdForConfirmation, confirm } = useConfirmation(true);
  const failure = [deleteState, toggleState].find((state) => state.status === "error");

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Stacked on phones, where the pinned column must stay narrow. */}
      <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
        <Link href={`/admin/news/${newsId}/edit`} className={buttonStyles({ variant: "secondary", size: "sm" })}>
          <Icon name="pencil" className="size-3.5" />
          {text.edit}
        </Link>
        <form action={toggleFormAction}>
          <SubmitButton size="sm" variant="secondary" pendingLabel={text.savePending} className="w-full sm:w-auto">
            {visible ? text.hide : text.show}
          </SubmitButton>
        </form>
        <form ref={formRef} action={deleteFormAction} onSubmit={holdForConfirmation}>
          <SubmitButton size="sm" variant="danger" pendingLabel={text.savePending} className="w-full sm:w-auto">
            {text.delete}
          </SubmitButton>
          <ConfirmDialog
            dialogRef={dialogRef}
            title={text.confirmDeleteTitle}
            confirmLabel={text.delete}
            cancelLabel={text.cancel}
            onConfirm={confirm}
          >
            <p>{text.confirmDeleteBody}</p>
            <p className="mt-2 text-fg">{summary}</p>
          </ConfirmDialog>
        </form>
      </div>
      {failure?.status === "error" ? (
        <p role="alert" className="text-xs text-loss">
          {failure.message}
        </p>
      ) : null}
    </div>
  );
}
