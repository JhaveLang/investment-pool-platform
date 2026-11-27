"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getI18n, type I18n } from "@/i18n/server";
import { errorState, readFormText, successState, validationErrorState, type ActionState } from "@/lib/action-state";
import { depositLimits, limitViolation, withdrawalLimits, type AmountLimits } from "@/lib/pool-settings";
import { getSchemas } from "@/lib/validation";
import { rateLimitedState, toErrorState } from "@/server/action-errors";
import { requireInvestor } from "@/server/auth/guards";
import { consumeRateLimit, rateLimitRules } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { sendRequestMail } from "@/server/request-mail";
import { getAccountOverview } from "@/server/queries/investor";
import { getPoolSettings } from "@/server/queries/pool-settings";
import { createDeposit } from "@/server/services/deposits";
import { requestWithdrawal } from "@/server/services/withdrawals";

/** The error for an amount outside the pool's limits, or null when it is within them. */
function limitErrorState(
  amountCents: number,
  limits: AmountLimits,
  { messages, format }: Pick<I18n, "messages" | "format">,
  values: Record<string, string>,
): ActionState | null {
  const violation = limitViolation(amountCents, limits);
  if (violation === null) {
    return null;
  }
  const message =
    violation === "tooSmall"
      ? messages.validation.amountTooSmall(format.currency(limits.minCents))
      : messages.validation.amountTooLarge(format.currency(limits.maxCents));
  return errorState(messages.errors.validation, { fieldErrors: { amount: message }, values });
}

export async function depositAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireInvestor();
  const { locale, messages, format } = await getI18n();
  const values = {
    amount: readFormText(formData, "amount"),
    method: readFormText(formData, "method"),
    promoOfferId: readFormText(formData, "promoOfferId"),
  };
  const parsed = getSchemas(locale).depositSchema.safeParse({
    ...values,
    idempotencyKey: readFormText(formData, "idempotencyKey"),
    promoOfferId: values.promoOfferId,
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  const rateLimit = await consumeRateLimit(`money:${user.id}`, rateLimitRules.moneyMovementPerUser);
  if (!rateLimit.allowed) {
    return rateLimitedState(rateLimit, messages);
  }

  if (parsed.data.promoOfferId) return errorState(messages.domainErrors.PROMO_NOT_BOOKABLE, { values });
  const limits = depositLimits(await getPoolSettings());
  const limitError = limitErrorState(parsed.data.amount, limits, { messages, format }, values);
  if (limitError) {
    return limitError;
  }

  try {
    const deposit = await createDeposit({
      userId: user.id,
      amountCents: parsed.data.amount,
      method: parsed.data.method,
      idempotencyKey: parsed.data.idempotencyKey,
      ipAddress: await getClientIp(),
    });
    if (deposit.newlyCreated) {
      after(() => sendRequestMail("deposit", deposit, user));
    }
    revalidatePath("/", "layout");
    return successState(messages.deposits.success(deposit.reference));
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
}

export async function withdrawalAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireInvestor();
  const { locale, messages, format } = await getI18n();
  const values = {
    amount: readFormText(formData, "amount"),
    method: readFormText(formData, "method"),
    iban: readFormText(formData, "iban"),
    walletAddress: readFormText(formData, "walletAddress"),
  };
  const parsed = getSchemas(locale).withdrawalSchema.safeParse({
    ...values,
    idempotencyKey: readFormText(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  const rateLimit = await consumeRateLimit(`money:${user.id}`, rateLimitRules.moneyMovementPerUser);
  if (!rateLimit.allowed) {
    return rateLimitedState(rateLimit, messages);
  }

  const { data } = parsed;
  const [settings, overview] = await Promise.all([getPoolSettings(), getAccountOverview(user.id)]);
  const limits = withdrawalLimits(settings, overview.availableCents, data.method);
  const limitError = limitErrorState(data.amount, limits, { messages, format }, values);
  if (limitError) {
    return limitError;
  }

  try {
    const withdrawal = await requestWithdrawal({
      userId: user.id,
      amountCents: data.amount,
      destination:
        data.method === "bank_transfer"
          ? { method: data.method, iban: data.iban }
          : { method: data.method, walletAddress: data.walletAddress },
      idempotencyKey: data.idempotencyKey,
      ipAddress: await getClientIp(),
    });
    if (withdrawal.newlyCreated) {
      after(() => sendRequestMail("withdrawal", withdrawal, user));
    }
    revalidatePath("/", "layout");
    return successState(messages.withdrawals.success(withdrawal.reference));
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
}
