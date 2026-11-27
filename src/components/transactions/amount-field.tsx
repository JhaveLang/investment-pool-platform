"use client";

import { useFormatter, useLocale, useMessages } from "@/i18n/client";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { parseAmountToCents } from "@/lib/money";
import type { AmountLimits } from "@/lib/pool-settings";

type AmountFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Limits of one request, shown to the right of the label. */
  limits: AmountLimits;
  /** Steps added to the current amount, in cents. */
  quickAdds: number[];
  /** Fills in the largest possible amount, e.g. what can be withdrawn on this route. */
  maxCents?: number;
  placeholder: string;
  hint?: string;
  error?: string;
};

/** A large amount well with a euro sign, the limits and quick-add steps (up to the limit); submitted as `amount`. */
export function AmountField({
  label,
  value,
  onChange,
  limits,
  quickAdds,
  maxCents,
  placeholder,
  hint,
  error,
}: AmountFieldProps) {
  const locale = useLocale();
  const format = useFormatter();
  const text = useMessages().amountField;
  const descriptionId = error || hint ? "field-amount-description" : undefined;
  // Written back without grouping ("11000,00"), which parses in both languages.
  const setCents = (cents: number) => onChange(format.decimal(cents));
  const currentCents = parseAmountToCents(value, locale) ?? 0;
  const quickAmountStyle = buttonStyles({ size: "sm", variant: "secondary", className: "min-h-9 px-1" });

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor="field-amount" className="label-caps text-muted">
          {label}
        </label>
        <span className="text-xs text-subtle">
          {text.limits(format.currency(limits.minCents), format.currency(limits.maxCents))}
        </span>
      </div>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl bg-well px-4 py-3 ring-1 ring-inset focus-within:ring-2",
          error ? "ring-loss/70 focus-within:ring-loss" : "ring-line-strong focus-within:ring-accent-400",
        )}
      >
        <span aria-hidden className="font-display text-2xl font-bold text-accent-400">
          €
        </span>
        <input
          id="field-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          required
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionId}
          className="amount w-0 min-w-0 flex-1 bg-transparent font-display text-[28px] leading-9 font-bold text-fg placeholder:text-highest focus:outline-none"
        />
        <span className="label-caps rounded-md bg-overlay px-2 py-1 text-muted">EUR</span>
      </div>
      <div className={cn("mt-2 grid gap-2", maxCents === undefined ? "grid-cols-3" : "grid-cols-4")}>
        {quickAdds.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => setCents(Math.min(currentCents + step, limits.maxCents))}
            className={quickAmountStyle}
            aria-label={text.addAmount(format.currency(step))}
          >
            +{format.wholeCurrency(step)}
          </button>
        ))}
        {maxCents !== undefined ? (
          <button
            type="button"
            onClick={() => setCents(maxCents)}
            disabled={maxCents <= 0}
            className={quickAmountStyle}
          >
            {text.max}
          </button>
        ) : null}
      </div>
      {descriptionId ? (
        <p id={descriptionId} className={cn("mt-2 text-[13px]", error ? "text-loss" : "text-subtle")}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
