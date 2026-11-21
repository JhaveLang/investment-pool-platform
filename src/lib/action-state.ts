import type { z } from "zod";

export type FieldErrors = Partial<Record<string, string>>;

/** Result returned by every form Server Action and rendered by the form components. */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: FieldErrors;
      /** Submitted (non-secret) values, so inputs keep their content after an error. */
      values?: Record<string, string>;
    };

export const idleActionState: ActionState = { status: "idle" };

export function successState(message: string): ActionState {
  return { status: "success", message };
}

export function errorState(
  message: string,
  options: { fieldErrors?: FieldErrors; values?: Record<string, string> } = {},
): ActionState {
  return { status: "error", message, ...options };
}

/** Maps a failed Zod parse to one (already localised) message per field. */
export function validationErrorState(
  error: z.ZodError,
  summaryMessage: string,
  values?: Record<string, string>,
): ActionState {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const fieldName = String(issue.path[0] ?? "form");
    fieldErrors[fieldName] ??= issue.message;
  }
  return errorState(summaryMessage, { fieldErrors, values });
}

export function fieldErrorsOf(state: ActionState): FieldErrors {
  return state.status === "error" ? (state.fieldErrors ?? {}) : {};
}

export function submittedValuesOf(state: ActionState): Record<string, string> {
  return state.status === "error" ? (state.values ?? {}) : {};
}

/** Reads a text field from FormData; missing fields become an empty string. */
export function readFormText(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value : "";
}
