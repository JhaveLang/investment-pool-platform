import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getI18n, pageMetadata } from "@/i18n/server";
import { homePathForRole } from "@/server/auth/guards";
import { getCurrentUser } from "@/server/auth/session";

export const generateMetadata = pageMetadata((messages) => messages.auth.loginTitle);

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(homePathForRole(user.role));
  }
  const text = (await getI18n()).messages.auth;

  return (
    <>
      <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight text-accent-400">
        {text.loginTitle}
      </h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">{text.loginSubtitle}</p>
      <LoginForm />
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">{text.accountsByAdmin}</p>
    </>
  );
}
