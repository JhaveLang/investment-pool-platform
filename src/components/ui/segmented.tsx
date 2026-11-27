import { buttonStyles, type ButtonSize } from "./button";

export const segmentGroupStyles = "flex flex-wrap gap-1.5";

export function segmentStyles(isActive: boolean, size: ButtonSize = "sm"): string {
  return buttonStyles({
    size,
    variant: isActive ? "selected" : "ghost",
    className: isActive ? "no-underline" : "bg-overlay text-fg hover:bg-highest",
  });
}
