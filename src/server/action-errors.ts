import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { Messages } from "@/i18n/dictionaries";
import { errorState, type ActionState } from "@/lib/action-state";
import { DomainError } from "@/lib/errors";
import type { RateLimitResult } from "@/server/rate-limit";

/** Converts a thrown error into a localised, user-safe action result. */
export function toErrorState(error: unknown, messages: Messages): ActionState {
  // Let Next.js control-flow errors (redirect, notFound) propagate untouched.
  unstable_rethrow(error);

  if (error instanceof DomainError) {
    return errorState(messages.domainErrors[error.code]);
  }
  console.error("[action] Unexpected error", error);
  return errorState(messages.errors.generic);
}

export function rateLimitedState(
  result: Extract<RateLimitResult, { allowed: false }>,
  messages: Messages,
): ActionState {
  return errorState(messages.errors.rateLimited(Math.ceil(result.retryAfterSeconds / 60)));
}
