"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const messages = useMessages();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-fg">{messages.errors.errorTitle}</h1>
      <p className="mt-2 max-w-md text-subtle">{messages.errors.errorDescription}</p>
      <Button className="mt-6" onClick={reset}>
        {messages.errors.retry}
      </Button>
    </main>
  );
}
