"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { errorState, readFormText, successState, validationErrorState, type ActionState } from "@/lib/action-state";
import { getSchemas } from "@/lib/validation";
import { toErrorState } from "@/server/action-errors";
import { requireAdmin, requireInvestor } from "@/server/auth/guards";
import { getClientIp } from "@/server/request";
import { createPromoOffer, markPromoConfirmationSent, processReadyPromoBookings, requestPromoBooking, settleMaturedPromoBookings, settleMaturedPromoReturns, updatePromoOffer } from "@/server/services/promos";
import { todayIsoDate } from "@/lib/calendar";
import { isPromoBookable, maxPromoBookingCents, MIN_STANDARD_POOL_BALANCE_CENTS } from "@/lib/promo";
import { getAccountOverview } from "@/server/queries/investor";
import { getPromoOffer } from "@/server/queries/promos";

function readValues(formData: FormData) {
  return {
    name: readFormText(formData, "name"),
    bookingUntil: readFormText(formData, "bookingUntil"),
    minDeposit: readFormText(formData, "minDeposit"),
    maxDeposit: readFormText(formData, "maxDeposit"),
    termMonths: readFormText(formData, "termMonths"),
    totalReturn: readFormText(formData, "totalReturn"),
    details: readFormText(formData, "details"),
    isExample: formData.get("isExample") === "on" ? "on" : "",
    visible: formData.get("visible") === "on" ? "on" : "",
  };
}

function parse(values: ReturnType<typeof readValues>, locale: "de" | "en", messages: Awaited<ReturnType<typeof getI18n>>["messages"]) {
  const parsed = getSchemas(locale).promoOfferSchema.safeParse({
    ...values,
    isExample: values.isExample === "on",
    visible: values.visible === "on",
  });
  return parsed.success ? parsed : validationErrorState(parsed.error, messages.errors.validation, values);
}

export async function createPromoAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const values = readValues(formData);
  const parsed = parse(values, locale, messages);
  if (!("data" in parsed)) return parsed;
  try {
    await createPromoOffer({ ...parsed.data, adminId: admin.id, ipAddress: await getClientIp() });
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  revalidatePath("/promos");
  redirect("/admin/promos?created=1");
}

export async function updatePromoAction(promoId: string, previousState: ActionState, formData: FormData): Promise<ActionState> {
  const result = await savePromoEditsAction(promoId, previousState, formData);
  if (result.status === "success") redirect("/admin/promos?saved=1");
  return result;
}

export async function savePromoEditsAction(promoId: string, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const schemas = getSchemas(locale);
  if (!schemas.promoIdSchema.safeParse(promoId).success) return errorState(messages.validation.invalidRequest);
  const values = readValues(formData);
  const parsed = parse(values, locale, messages);
  if (!("data" in parsed)) return parsed;
  try {
    const found = await updatePromoOffer({ promoId, ...parsed.data, adminId: admin.id, ipAddress: await getClientIp() });
    if (!found) return errorState(messages.domainErrors.NOT_FOUND);
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  revalidatePath("/promos");
  revalidatePath("/admin/promos");
  return successState(messages.admin.promos.saved);
}

export async function setPromoVisibilityAction(promoId: string, visible: boolean): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  if (!getSchemas(locale).promoIdSchema.safeParse(promoId).success) return errorState(messages.validation.invalidRequest);
  try {
    const found = await updatePromoOffer({ promoId, visible, adminId: admin.id, ipAddress: await getClientIp() });
    if (!found) return errorState(messages.domainErrors.NOT_FOUND);
  } catch (error) {
    return toErrorState(error, messages);
  }
  revalidatePath("/promos");
  revalidatePath("/admin/promos");
  return successState(visible ? messages.admin.promos.shownDone : messages.admin.promos.hiddenDone);
}

export async function settlePromoMaturitiesAction(): Promise<ActionState> {
  const admin = await requireAdmin();
  const { messages, format } = await getI18n();
  try {
    const result = await settleMaturedPromoReturns({ adminId: admin.id, ipAddress: await getClientIp(), today: todayIsoDate() });
    revalidatePath("/admin/promos");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/admin/returns");
    return successState(messages.admin.promos.settled(result.count, format.currency(result.totalCents)));
  } catch (error) {
    return toErrorState(error, messages);
  }
}

export async function checkPromoBookingAction(promoId: string) {
  const user = await requireInvestor();
  const [offer, { messages, format }] = await Promise.all([getPromoOffer(promoId), getI18n()]);
  if (!offer || !isPromoBookable(offer, todayIsoDate())) {
    return { message: messages.domainErrors.PROMO_NOT_BOOKABLE, showBalanceDetails: false };
  }
  const overview = await getAccountOverview(user.id);
  if (maxPromoBookingCents(offer, overview) > 0) return null;
  const required = format.currency(offer.minDepositCents + MIN_STANDARD_POOL_BALANCE_CENTS);
  const reserve = format.currency(MIN_STANDARD_POOL_BALANCE_CENTS);
  return { message: messages.admin.promos.notEnoughTransferable(required, reserve), showBalanceDetails: true };
}

export async function bookPromoAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireInvestor();
  const { locale, messages } = await getI18n();
  const values = { promoId: readFormText(formData, "promoId"), amount: readFormText(formData, "amount") };
  const parsed = getSchemas(locale).promoBookingSchema.safeParse({ ...values, idempotencyKey: readFormText(formData, "idempotencyKey") });
  if (!parsed.success) return validationErrorState(parsed.error, messages.errors.validation, values);
  let reference: string;
  try {
    const booking = await requestPromoBooking({ userId: user.id, ...parsed.data, ipAddress: await getClientIp() });
    reference = booking.reference;
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  revalidatePath("/promos");
  revalidatePath("/dashboard");
  redirect(`/promos?requested=${encodeURIComponent(reference)}`);
}

export async function processReadyPromoBookingsAction(): Promise<ActionState> {
  const admin = await requireAdmin(); const { messages } = await getI18n();
  try {
    const count = await processReadyPromoBookings({ adminId: admin.id, ipAddress: await getClientIp(), today: todayIsoDate() });
    revalidatePath("/admin/promos"); revalidatePath("/dashboard"); revalidatePath("/transactions");
    return successState(messages.admin.promos.processed(count));
  } catch (error) { return toErrorState(error, messages); }
}

export async function markPromoConfirmationSentAction(bookingId: string): Promise<ActionState> {
  const admin = await requireAdmin(); const { messages } = await getI18n();
  try {
    const found = await markPromoConfirmationSent({ bookingId, adminId: admin.id, ipAddress: await getClientIp() });
    if (!found) return errorState(messages.validation.invalidRequest);
    revalidatePath("/admin/promos"); return successState(messages.admin.promos.confirmationMarked);
  } catch (error) { return toErrorState(error, messages); }
}

export async function settlePromoBookingMaturitiesAction(): Promise<ActionState> {
  const admin = await requireAdmin(); const { messages, format } = await getI18n();
  try {
    const result = await settleMaturedPromoBookings({ adminId: admin.id, ipAddress: await getClientIp(), today: todayIsoDate() });
    revalidatePath("/admin/promos"); revalidatePath("/dashboard"); revalidatePath("/transactions");
    return successState(messages.admin.promos.promoBookingsSettled(result.count, format.currency(result.totalCents)));
  } catch (error) { return toErrorState(error, messages); }
}
