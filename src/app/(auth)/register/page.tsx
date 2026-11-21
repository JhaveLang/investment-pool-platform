import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getI18n, pageMetadata } from "@/i18n/server";
import { homePathForRole } from "@/server/auth/guards";
import { getCurrentUser } from "@/server/auth/session";

export const generateMetadata = pageMetadata((messages) => messages.auth.registerTitle);

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(homePathForRole(user.role));
  }
  const text = (await getI18n()).messages.auth;

  return (
    <>
      <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight text-fg">{text.registerTitle}</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">{text.registerSubtitle}</p>
      <RegisterForm />
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
        {text.hasAccount}{" "}
        <Link href="/login" className="font-semibold text-accent-400 hover:text-accent-300">
          {text.loginLink}
        </Link>
      </p>
    </>
  );
}
