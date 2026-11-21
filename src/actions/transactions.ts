"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { readFormText, successState, validationErrorState, type ActionState } from "@/lib/action-state";
import { getSchemas } from "@/lib/validation";
import { rateLimitedState, toErrorState } from "@/server/action-errors";
import { requireInvestor } from "@/server/auth/guards";
import { consumeRateLimit, rateLimitRules } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { createDeposit } from "@/server/services/deposits";
import { requestWithdrawal } from "@/server/services/withdrawals";

export async function depositAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireInvestor();
  const { locale, messages } = await getI18n();
  const values = { amount: readFormText(formData, "amount"), method: readFormText(formData, "method") };
  const parsed = getSchemas(locale).depositSchema.safeParse({
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

  try {
    const deposit = await createDeposit({
      userId: user.id,
      amountCents: parsed.data.amount,
      method: parsed.data.method,
      idempotencyKey: parsed.data.idempotencyKey,
      ipAddress: await getClientIp(),
    });
    revalidatePath("/", "layout");
    return successState(messages.deposits.success(deposit.reference));
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
}

export async function withdrawalAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireInvestor();
  const { locale, messages } = await getI18n();
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

  try {
    const { data } = parsed;
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
    revalidatePath("/", "layout");
    return successState(messages.withdrawals.success(withdrawal.reference));
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
}
