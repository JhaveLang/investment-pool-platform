"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { readFormText, successState, validationErrorState, type ActionState } from "@/lib/action-state";
import { getSchemas } from "@/lib/validation";
import { toErrorState } from "@/server/action-errors";
import { requireAdmin } from "@/server/auth/guards";
import { getClientIp } from "@/server/request";
import { updatePoolSettings } from "@/server/services/pool-settings";

/** Admin opens or closes the pool to deposits and sets the deposit dates, the limits and the notice. */
export async function updatePoolSettingsAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, messages } = await getI18n();
  const values = {
    depositsOpen: formData.get("depositsOpen") === "on" ? "on" : "",
    depositsFrom: readFormText(formData, "depositsFrom"),
    depositsUntil: readFormText(formData, "depositsUntil"),
    depositMin: readFormText(formData, "depositMin"),
    depositMax: readFormText(formData, "depositMax"),
    withdrawalMin: readFormText(formData, "withdrawalMin"),
    withdrawalMax: readFormText(formData, "withdrawalMax"),
    noticeDe: readFormText(formData, "noticeDe"),
    noticeEn: readFormText(formData, "noticeEn"),
  };
  const parsed = getSchemas(locale).poolSettingsSchema.safeParse({
    ...values,
    depositsOpen: values.depositsOpen === "on",
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error, messages.errors.validation, values);
  }

  let outcome: "updated" | "unchanged";
  try {
    outcome = await updatePoolSettings({
      settings: parsed.data,
      adminId: admin.id,
      ipAddress: await getClientIp(),
    });
  } catch (error) {
    const failure = toErrorState(error, messages);
    return failure.status === "error" ? { ...failure, values } : failure;
  }
  // The investors' deposit and withdrawal pages show the settings too.
  revalidatePath("/", "layout");
  return successState(outcome === "updated" ? messages.admin.pool.saved : messages.admin.pool.unchanged);
}
