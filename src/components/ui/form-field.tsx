import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const inputStyles = cn(
  "block w-full rounded-lg border-0 bg-well px-3.5 py-2.5 text-sm text-fg ring-1 ring-inset ring-line-strong",
  "placeholder:text-subtle focus:ring-2 focus:ring-inset focus:ring-accent-400 focus:outline-none",
  "aria-invalid:ring-loss/70 aria-invalid:focus:ring-loss",
);

export const labelStyles = "label-caps mb-2 block text-muted";

type FormFieldProps = ComponentProps<"input"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

/** Label + input + hint/error, wired up with the right ARIA attributes. */
export function FormField({ name, label, error, hint, id, className, ...inputProps }: FormFieldProps) {
  const inputId = id ?? `field-${name}`;
  const descriptionId = error || hint ? `${inputId}-description` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className={labelStyles}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId}
        className={inputStyles}
        {...inputProps}
      />
      {descriptionId ? (
        <p id={descriptionId} className={cn("mt-1.5 text-[13px]", error ? "text-loss" : "text-subtle")}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
