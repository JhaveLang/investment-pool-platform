"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE_NAME } from "@/i18n/config";
import { isSecureCookieEnabled } from "@/server/env";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Stores the chosen language in a cookie and re-renders the current page in it. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const requestedLocale = formData.get("locale");
  if (!isLocale(requestedLocale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, requestedLocale, {
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath("/", "layout");
}
