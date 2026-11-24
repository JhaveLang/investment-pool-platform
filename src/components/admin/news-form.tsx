"use client";

import { useActionState } from "react";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField, labelStyles, TextAreaField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { MAX_NEWS_TEXT_LENGTH } from "@/lib/news";

type NewsFormProps = {
  /** Create action, or the update action with the notice id already bound. */
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  /** Today's date for a new notice, or the notice's current values when editing. */
  initial: { publishedOn: string; textDe: string; visible: boolean };
  /** When editing: the current English translation (null if there is none yet), shown read-only. */
  english?: string | null;
  submitLabel: string;
};

/** Date, German text and whether the website shows the notice; DeepL translates the text when it is saved. */
export function NewsForm({ action, initial, english, submitLabel }: NewsFormProps) {
  const text = useMessages().admin.news;
  const [state, formAction] = useActionState(action, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const submitted = submittedValuesOf(state);
  // After a failed save the form shows what was submitted, otherwise the initial values.
  const failed = state.status === "error" && state.values !== undefined;

  return (
    <form action={formAction} noValidate className="space-y-5">
      <ActionStateAlert state={state} />
      <FormField
        name="publishedOn"
        type="date"
        label={text.date}
        required
        className="max-w-xs"
        defaultValue={failed ? submitted.publishedOn : initial.publishedOn}
        hint={text.dateHint}
        error={fieldErrors.publishedOn}
      />
      <TextAreaField
        name="textDe"
        label={text.textDe}
        required
        rows={3}
        maxLength={MAX_NEWS_TEXT_LENGTH}
        defaultValue={failed ? submitted.textDe : initial.textDe}
        error={fieldErrors.textDe}
      />
      {english === undefined ? null : (
        <div>
          <p className={labelStyles}>{text.englishLabel}</p>
          <p
            className={cn(
              "rounded-lg bg-well px-3.5 py-2.5 text-sm leading-relaxed",
              english ? "text-muted" : "text-subtle",
            )}
          >
            {english ?? text.englishMissing}
          </p>
        </div>
      )}
      <label className="flex items-start gap-3 text-sm text-fg">
        <input
          type="checkbox"
          name="visible"
          defaultChecked={failed ? submitted.visible === "on" : initial.visible}
          className="mt-0.5 size-4 shrink-0 accent-accent-400"
        />
        <span>
          {text.visibleLabel}
          <span className="mt-0.5 block text-[13px] text-subtle">{text.visibleHint}</span>
        </span>
      </label>
      <div className="flex justify-end">
        <SubmitButton pendingLabel={text.savePending}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
