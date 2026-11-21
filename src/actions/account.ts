"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { errorState, readFormText, successState, validationErrorState, type ActionState } from "@/lib/action-state";
import { DomainError } from "@/lib/errors";
import { getSchemas } from "@/lib/validation";
import { rateLimitedState, toErrorState } from "@/server/action-errors";
import { requireAdmin, requireUser } from "@/server/auth/guards";
import { getCurrentSessionId } from "@/server/auth/session";
import { consumeRateLimits, rateLimitRules } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { changeOwnPassword, setInvestorPassword, updateInvestorProfile } from "@/server/services/account";

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

// The investor id is bound on the server (`action.bind(null, id)`), the rest comes from the form.

/** Admin edits an investor's name and email. */
export async function updateInvestorAction(
  userId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const values = { fullName: readFormText(formData, "fullName"), email: readFormText(formData, "email") };
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
      ipAddress: await getClientIp(),
    });
    if (outcome === "unchanged") {
      return successState(messages.admin.investorDetail.unchanged);
    }
  } catch (error) {
    if (error instanceof DomainError && error.code === "EMAIL_TAKEN") {
      return errorState(messages.errors.validation, {
        fieldErrors: { email: messages.domainErrors.EMAIL_TAKEN },
        values,
      });
    }
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  revalidatePath("/admin", "layout");
  return successState(messages.admin.investorDetail.saved);
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
