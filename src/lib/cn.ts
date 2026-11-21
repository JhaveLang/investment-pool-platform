import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges conditional class names and resolves conflicting Tailwind utilities. */
export function cn(...classValues: ClassValue[]): string {
  return twMerge(clsx(classValues));
}
