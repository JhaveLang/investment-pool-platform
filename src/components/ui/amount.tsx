import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";

/** Signed amount: credits in green with "+", debits in red with "−". */
export async function SignedAmount({ cents, className }: { cents: number; className?: string }) {
  const { format } = await getI18n();
  return (
    <span className={cn("amount font-semibold", cents >= 0 ? "text-gain" : "text-loss", className)}>
      {format.signedCurrency(cents)}
    </span>
  );
}
