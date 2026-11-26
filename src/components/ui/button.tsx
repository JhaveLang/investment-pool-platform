import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variantStyles = {
  primary: "bg-accent-400 text-accent-ink hover:bg-accent-300",
  secondary: "bg-overlay text-accent-400 hover:bg-highest",
  danger: "bg-loss/10 text-loss ring-1 ring-inset ring-loss/30 hover:bg-loss/15",
  ghost: "bg-raised text-muted hover:bg-overlay hover:text-fg",
} as const;

const sizeStyles = {
  sm: "h-8 rounded-lg px-3 text-[13px]",
  md: "h-10 rounded-lg px-4 text-sm",
  lg: "h-12 rounded-lg px-5 text-[15px]",
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
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & ButtonStyleOptions;

export function Button({ variant, size, className, type = "button", ...buttonProps }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...buttonProps} />;
}
