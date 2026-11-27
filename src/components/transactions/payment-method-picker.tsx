"use client";

import { Icon, type IconName } from "@/components/ui/icon";
import { useMessages } from "@/i18n/client";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/fees";
import { cn } from "@/lib/cn";

const methodIcons: Record<PaymentMethod, IconName> = {
  bank_transfer: "bank",
  crypto: "wallet",
  exchange: "swap",
};

type PaymentMethodPickerProps = {
  legend: string;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  /** Short fee note under each option, e.g. "98 % Gutschrift". */
  describe: (method: PaymentMethod) => string;
  error?: string;
};

/** Bank transfer, crypto and exchange as selectable route rows; submitted as `method`. */
export function PaymentMethodPicker({ legend, value, onChange, describe, error }: PaymentMethodPickerProps) {
  const methodLabels = useMessages().paymentMethods;
  const errorId = error ? "field-method-error" : undefined;

  return (
    <fieldset aria-describedby={errorId}>
      <legend className="label-caps mb-2 block text-muted">{legend}</legend>
      <div className="flex flex-col gap-2">
        {PAYMENT_METHODS.map((method) => {
          const isSelected = value === method;
          return (
            <label
              key={method}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1 transition-colors ring-inset has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-400",
                isSelected ? "bg-accent-400 text-accent-ink ring-accent-400" : "bg-raised text-fg ring-transparent hover:bg-overlay",
              )}
            >
              <input
                type="radio"
                name="method"
                value={method}
                checked={isSelected}
                onChange={() => onChange(method)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-lg",
                  isSelected ? "bg-white/15" : "bg-overlay text-muted",
                )}
              >
                <Icon name={methodIcons[method]} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold">{methodLabels[method]}</span>
                <span className={cn("block text-xs", !isSelected && "text-subtle")}>
                  {describe(method)}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full ring-1",
                  isSelected ? "ring-accent-ink" : "ring-line-strong",
                )}
              >
                {isSelected ? (
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="m6 12.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-loss">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Restores the submitted method after a failed submit, defaulting to bank transfer. */
export function initialPaymentMethod(submittedValue: string | undefined): PaymentMethod {
  return PAYMENT_METHODS.find((method) => method === submittedValue) ?? "bank_transfer";
}
