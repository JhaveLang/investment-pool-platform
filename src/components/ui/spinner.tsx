import { getI18n } from "@/i18n/server";

export async function PageSpinner() {
  const { messages } = await getI18n();
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-muted">
      <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-accent-400" />
      {messages.common.loading}
    </div>
  );
}
