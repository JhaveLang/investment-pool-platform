"use server";

import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { errorState, readFormText, validationErrorState, type ActionState } from "@/lib/action-state";
import { WELCOME_PATH } from "@/lib/onboarding";
import { getSchemas } from "@/lib/validation";
import { rateLimitedState, toErrorState } from "@/server/action-errors";
import { homePathForRole } from "@/server/auth/guards";
import { createSession, deleteCurrentSession, getCurrentUser, type SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { hasDeposit } from "@/server/queries/investor";
import { consumeRateLimits, rateLimitRules } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { recordAudit } from "@/server/services/audit";
import { authenticate } from "@/server/services/auth";

export async function loginAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, messages } = await getI18n();
  const values = { email: readFormText(formData, "email") };
  const parsed = getSchemas(locale).loginSchema.safeParse({
    email: values.email,
    password: readFormText(formData, "password"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  const ipAddress = await getClientIp();
  const rateLimit = await consumeRateLimits([
    { key: `login:ip:${ipAddress ?? "unknown"}`, rule: rateLimitRules.loginPerIp },
    { key: `login:email:${parsed.data.email}`, rule: rateLimitRules.loginPerEmail },
  ]);
  if (!rateLimit.allowed) {
    return rateLimitedState(rateLimit, messages);
  }

  let user: SessionUser | null;
  try {
    user = await authenticate({ ...parsed.data, ipAddress });
    if (user) {
      await createSession(user.id);
    }
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }

  if (!user) {
    return errorState(messages.auth.invalidCredentials, { values });
  }
  // Until their first deposit, investors land on the welcome popup with the way to it.
  if (user.role === "investor" && !(await hasDeposit(user.id))) {
    redirect(WELCOME_PATH);
  }
  redirect(homePathForRole(user.role));
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await recordAudit(getDb(), {
      actorUserId: user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: user.id,
      ipAddress: await getClientIp(),
    });
  }
  await deleteCurrentSession();
  redirect("/login");
}
