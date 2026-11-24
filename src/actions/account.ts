"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Messages } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import {
  errorState,
  readFormText,
  successState,
  validationErrorState,
  type ActionState,
  type FieldErrors,
} from "@/lib/action-state";
import { DomainError } from "@/lib/errors";
import { getSchemas } from "@/lib/validation";
import { rateLimitedState, toErrorState } from "@/server/action-errors";
import { requireAdmin, requireUser } from "@/server/auth/guards";
import { getCurrentSessionId } from "@/server/auth/session";
import { consumeRateLimits, rateLimitRules } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import {
  changeOwnPassword,
  setInvestorPassword,
  setInvestorStatus,
  updateInvestorCodes,
  updateInvestorProfile,
  type UpdateInvestorCodesResult,
} from "@/server/services/account";
import { createInvestor } from "@/server/services/auth";

/** Lets the signed-in user change their own password; every other session is ended. Never echoes passwords. */
export async function changePasswordAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, messages } = await getI18n();
  const parsed = getSchemas(locale).changePasswordSchema.safeParse({
    currentPassword: readFormText(formData, "currentPassword"),
    newPassword: readFormText(formData, "newPassword"),
    newPasswordConfirmation: readFormText(formData, "newPasswordConfirmation"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation);
  }

  const rateLimit = await consumeRateLimits([
    { key: `password-change:user:${user.id}`, rule: rateLimitRules.passwordChangePerUser },
  ]);
  if (!rateLimit.allowed) {
    return rateLimitedState(rateLimit, messages);
  }

  try {
    await changeOwnPassword({
      userId: user.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      keepSessionId: await getCurrentSessionId(),
      ipAddress: await getClientIp(),
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "WRONG_PASSWORD") {
      return errorState(messages.errors.validation, {
        fieldErrors: { currentPassword: messages.domainErrors.WRONG_PASSWORD },
      });
    }
    return toErrorState(error, messages);
  }
  return successState(messages.profile.passwordChanged);
}

/** A taken email or investor ID is shown on its form field rather than as a general error. */
function takenFieldError(error: unknown, messages: Messages): FieldErrors | null {
  if (error instanceof DomainError && error.code === "EMAIL_TAKEN") {
    return { email: messages.domainErrors.EMAIL_TAKEN };
  }
  if (error instanceof DomainError && error.code === "INVESTOR_CODE_TAKEN") {
    return { investorCode: messages.domainErrors.INVESTOR_CODE_TAKEN };
  }
  return null;
}

/**
 * Admin creates an investor with a starting password (accounts are only created by admins), then opens the new
 * investor's page. Never echoes passwords.
 */
export async function createInvestorAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const values = {
    fullName: readFormText(formData, "fullName"),
    email: readFormText(formData, "email"),
    investorCode: readFormText(formData, "investorCode"),
  };
  const parsed = getSchemas(locale).createInvestorSchema.safeParse({
    ...values,
    password: readFormText(formData, "password"),
    passwordConfirmation: readFormText(formData, "passwordConfirmation"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  let investorId: string;
  try {
    const investor = await createInvestor({
      ...parsed.data,
      createdByAdminId: admin.id,
      ipAddress: await getClientIp(),
    });
    investorId = investor.id;
  } catch (error) {
    const fieldErrors = takenFieldError(error, messages);
    if (fieldErrors) {
      return errorState(messages.errors.validation, { fieldErrors, values });
    }
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/investors/${investorId}?created=1`);
}

// The investor id is bound on the server (`action.bind(null, id)`), the rest comes from the form.

/** Admin edits an investor's name, email and investor ID. */
export async function updateInvestorAction(
  userId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const values = {
    fullName: readFormText(formData, "fullName"),
    email: readFormText(formData, "email"),
    investorCode: readFormText(formData, "investorCode"),
  };
  const parsed = getSchemas(locale).adminUpdateInvestorSchema.safeParse({ userId, ...values });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  try {
    const outcome = await updateInvestorProfile({
      adminId: admin.id,
      userId: parsed.data.userId,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      investorCode: parsed.data.investorCode,
      ipAddress: await getClientIp(),
    });
    if (outcome === "unchanged") {
      return successState(messages.admin.investorDetail.unchanged);
    }
  } catch (error) {
    const fieldErrors = takenFieldError(error, messages);
    if (fieldErrors) {
      return errorState(messages.errors.validation, { fieldErrors, values });
    }
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  revalidatePath("/admin", "layout");
  return successState(messages.admin.investorDetail.saved);
}

/**
 * Admin saves the investor IDs edited in the investor list, all or nothing. Errors are keyed by user id so every row
 * shows its own, and `values` holds the submitted IDs, so a row's error goes away once its ID is edited again.
 */
export async function saveInvestorCodesAction(_previousState: ActionState, changes: unknown): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const text = messages.admin.investorCodes;

  // The arguments come from the client as they are; read the user id and ID of each entry defensively.
  const entries = Array.isArray(changes) ? changes : [];
  const entryAt = (index: PropertyKey | undefined) => {
    const entry: unknown = typeof index === "number" ? entries[index] : undefined;
    return typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
  };
  const values: Record<string, string> = {};
  entries.forEach((_entry, index) => {
    const { userId, investorCode } = entryAt(index);
    if (typeof userId === "string" && typeof investorCode === "string") {
      values[userId] = investorCode.trim().toUpperCase();
    }
  });

  const parsed = getSchemas(locale).adminInvestorCodesSchema.safeParse(changes);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const [index, field] = issue.path;
      const { userId } = entryAt(index);
      if (field !== "investorCode" || typeof userId !== "string") {
        return errorState(messages.validation.invalidRequest);
      }
      fieldErrors[userId] ??= issue.message;
    }
    return errorState(text.checkMarked, { fieldErrors, values });
  }

  let outcome: UpdateInvestorCodesResult;
  try {
    outcome = await updateInvestorCodes({ adminId: admin.id, changes: parsed.data, ipAddress: await getClientIp() });
  } catch (error) {
    return toErrorState(error, messages);
  }
  if (outcome.status === "taken") {
    const fieldErrors: FieldErrors = {};
    for (const userId of outcome.userIds) {
      fieldErrors[userId] = messages.domainErrors.INVESTOR_CODE_TAKEN;
    }
    return errorState(text.checkMarked, { fieldErrors, values });
  }
  if (outcome.count === 0) {
    return successState(messages.admin.investorDetail.unchanged);
  }
  revalidatePath("/admin", "layout");
  return successState(text.saved(outcome.count));
}

/** Admin sets a new password for an investor; the investor is signed out everywhere. Never echoes passwords. */
export async function setInvestorPasswordAction(
  userId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const parsed = getSchemas(locale).adminSetPasswordSchema.safeParse({
    userId,
    newPassword: readFormText(formData, "newPassword"),
    newPasswordConfirmation: readFormText(formData, "newPasswordConfirmation"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation);
  }

  try {
    await setInvestorPassword({
      adminId: admin.id,
      userId: parsed.data.userId,
      newPassword: parsed.data.newPassword,
      ipAddress: await getClientIp(),
    });
  } catch (error) {
    return toErrorState(error, messages);
  }
  return successState(messages.admin.investorDetail.passwordSet);
}

/** Admin deactivates an investor (no sign-in, signed out everywhere) or activates them again. */
export async function setInvestorStatusAction(
  userId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const parsed = getSchemas(locale).adminInvestorStatusSchema.safeParse({
    userId,
    status: readFormText(formData, "status"),
    note: readFormText(formData, "note"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation);
  }

  const active = parsed.data.status === "active";
  try {
    await setInvestorStatus({
      adminId: admin.id,
      userId: parsed.data.userId,
      active,
      note: parsed.data.note,
      ipAddress: await getClientIp(),
    });
  } catch (error) {
    return toErrorState(error, messages);
  }
  revalidatePath("/admin", "layout");
  return successState(active ? messages.admin.investorDetail.activated : messages.admin.investorDetail.deactivated);
}
