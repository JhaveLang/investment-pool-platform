import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "./button";
import { inputStyles } from "./form-field";
import { Icon } from "./icon";

/**
 * A native select with the app's own chevron, so the padding is the same on both sides and the height matches the
 * text inputs (the browser's arrow sits against the right edge). `className` sizes the wrapper.
 */
type SelectProps = ComponentProps<"select"> & { variant?: "field" | "button" };

export function Select({ className, variant = "field", ...selectProps }: SelectProps) {
  const button = variant === "button";
  const controlStyles = button
    ? buttonStyles({ size: "sm", className: "h-8 w-full appearance-none rounded-none pr-8 text-left" })
    : cn(inputStyles, "cursor-pointer appearance-none pr-10");
  return (
    <div className={cn("relative", className)}>
      <select {...selectProps} className={controlStyles} />
      <Icon
        name="chevronDown"
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2",
          button ? "right-2 text-accent-ink" : "right-3.5 text-muted",
        )}
      />
    </div>
  );
}
