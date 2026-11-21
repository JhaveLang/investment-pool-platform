import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { messages } = await getI18n();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold text-fg">{messages.errors.notFoundTitle}</h1>
      <p className="mt-2 text-subtle">{messages.errors.notFoundDescription}</p>
      <Link href="/" className={buttonStyles({ className: "mt-6" })}>
        {messages.errors.backHome}
      </Link>
    </main>
  );
}
