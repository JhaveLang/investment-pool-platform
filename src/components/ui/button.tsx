import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const accentFill = "border-accent-400 bg-accent-400 text-accent-ink";
const accentButtonStyles = cn(accentFill, "hover:border-accent-300 hover:bg-accent-300 active:shadow-inner");

const variantStyles = {
  primary: accentButtonStyles,
  secondary: accentButtonStyles,
  selected: accentFill,
  danger: "border-loss/40 bg-loss/5 text-loss hover:border-loss hover:bg-loss hover:text-white active:shadow-inner",
  ghost: "border-transparent bg-transparent text-accent-400 hover:bg-overlay",
} as const;

const sizeStyles = {
  sm: "min-h-8 px-3 py-1 text-[13px]",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-11 px-6 py-2.5 text-[15px]",
  iconSm: "size-8 shrink-0 p-0",
  icon: "size-10 shrink-0 p-0",
} as const;

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/** Shared so links can look like buttons: `<Link className={buttonStyles()} />`. */
export function buttonStyles({ variant = "primary", size = "md", className }: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex max-w-full cursor-pointer items-center justify-center gap-2 rounded-xs border text-center leading-tight font-semibold [&>svg]:shrink-0",
    "transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    "active:border-accent-400 active:bg-accent-400 active:text-accent-ink",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

/** For the summary of a native details menu with the Tailwind group class. */
export const menuToggleStyles = buttonStyles({
  variant: "ghost",
  size: "icon",
  className: "list-none group-open:border-accent-400 group-open:bg-accent-400 group-open:text-accent-ink group-open:hover:bg-accent-400 [&::-webkit-details-marker]:hidden",
});

type ButtonProps = ComponentProps<"button"> & ButtonStyleOptions;

export function Button({ variant, size, className, type = "button", ...buttonProps }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...buttonProps} />;
}
