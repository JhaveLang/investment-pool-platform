import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { inputStyles } from "./form-field";
import { Icon } from "./icon";

/**
 * A native select with the app's own chevron, so the padding is the same on both sides and the height matches the
 * text inputs (the browser's arrow sits against the right edge). `className` sizes the wrapper.
 */
export function Select({ className, ...selectProps }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select {...selectProps} className={cn(inputStyles, "cursor-pointer appearance-none pr-10")} />
      <Icon
        name="chevronDown"
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
