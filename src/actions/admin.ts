"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { z } from "zod";
import { getI18n } from "@/i18n/server";
import { readFormText, successState, validationErrorState, type ActionState } from "@/lib/action-state";
import { getSchemas, type ValidationSchemas } from "@/lib/validation";
import { toErrorState } from "@/server/action-errors";
import { requireAdmin } from "@/server/auth/guards";
import { getClientIp } from "@/server/request";
import { sendInvestorUpdateMail } from "@/server/request-mail";
import { reconcileDeposit, rejectDeposit } from "@/server/services/deposits";
import { bookMonthlyReturn } from "@/server/services/returns";
import type { ReviewInput } from "@/server/services/types";
import { approveWithdrawal, rejectWithdrawal } from "@/server/services/withdrawals";

type ReviewSuccessMessageKey = "depositReconciled" | "depositRejected" | "withdrawalApproved" | "withdrawalRejected";

type ReviewFields = { recordId: string; note?: string };

/** Shared flow for every admin decision: authorize, validate, perform, refresh. */
async function runReview<Fields extends ReviewFields>(
  recordId: string,
  formData: FormData,
  selectSchema: (schemas: ValidationSchemas) => { safeParse: (value: unknown) => z.ZodSafeParseResult<Fields> },
  perform: (input: ReviewInput, fields: Fields) => Promise<number>,
  successMessageKey: ReviewSuccessMessageKey,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const parsed = selectSchema(getSchemas(locale)).safeParse({
    recordId,
    note: readFormText(formData, "note"),
    receivedOn: readFormText(formData, "receivedOn"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation);
  }

  try {
    const input: ReviewInput = {
      recordId: parsed.data.recordId,
      reviewerId: admin.id,
      note: parsed.data.note,
      ipAddress: await getClientIp(),
    };
    const auditLogId = await perform(input, parsed.data);
    after(() => sendInvestorUpdateMail(auditLogId));
    revalidatePath("/", "layout");
    return successState(messages.admin.review[successMessageKey]);
  } catch (error) {
    return toErrorState(error, messages);
  }
}

// The record id is bound on the server (`action.bind(null, id)`), the rest comes from the form.

const reviewSchema = (schemas: ValidationSchemas) => schemas.reviewSchema;

export async function reconcileDepositAction(depositId: string, _previousState: ActionState, formData: FormData) {
  return runReview(
    depositId,
    formData,
    (schemas) => schemas.reconcileSchema,
    (input, fields) => reconcileDeposit({ ...input, receivedOn: fields.receivedOn }),
    "depositReconciled",
  );
}

export async function rejectDepositAction(depositId: string, _previousState: ActionState, formData: FormData) {
  return runReview(depositId, formData, reviewSchema, rejectDeposit, "depositRejected");
}

export async function approveWithdrawalAction(withdrawalId: string, _previousState: ActionState, formData: FormData) {
  return runReview(withdrawalId, formData, reviewSchema, approveWithdrawal, "withdrawalApproved");
}

export async function rejectWithdrawalAction(withdrawalId: string, _previousState: ActionState, formData: FormData) {
  return runReview(withdrawalId, formData, reviewSchema, rejectWithdrawal, "withdrawalRejected");
}

/** Books the previewed monthly result for every account, then returns to the overview. */
export async function bookMonthlyReturnAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const parsed = getSchemas(locale).bookReturnSchema.safeParse({
    month: readFormText(formData, "month"),
    rate: readFormText(formData, "rate"),
    expectedTotalCents: readFormText(formData, "expectedTotalCents"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation);
  }

  try {
    const period = await bookMonthlyReturn({
      month: parsed.data.month,
      ratePpm: parsed.data.rate,
      expectedTotalCents: parsed.data.expectedTotalCents,
      adminUserId: admin.id,
      ipAddress: await getClientIp(),
    });
    after(() => sendInvestorUpdateMail(period.auditLogId));
  } catch (error) {
    return toErrorState(error, messages);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/returns?booked=${parsed.data.month}`);
}
