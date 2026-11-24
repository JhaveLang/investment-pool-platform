import { randomInt } from "node:crypto";

/** Upper-case letters without I and O (easily confused with 1 and 0). */
export const INVESTOR_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export const INVESTOR_CODE_MIN_LENGTH = 6;
export const INVESTOR_CODE_MAX_LENGTH = 20;

/**
 * Investor ID: 6–20 upper-case letters, digits and hyphens, e.g. "01GR01" or "INV-0042". Mirrored by the
 * `users_investor_code_format` check in the schema; keep both in step.
 */
export const INVESTOR_CODE_PATTERN = /^[A-Z0-9-]{6,20}$/;

/** Generates an investor ID like "01GR01"; `randomIndex(n)` must return an integer in [0, n). */
export function generateInvestorCode(randomIndex: (exclusiveMax: number) => number = randomInt): string {
  const digit = () => String(randomIndex(10));
  const letter = () => INVESTOR_CODE_LETTERS[randomIndex(INVESTOR_CODE_LETTERS.length)];
  return digit() + digit() + letter() + letter() + digit() + digit();
}

/** Prepares an admin search query for matching against investor IDs. */
export function normalizeInvestorCodeQuery(value: string): string {
  return value.trim().toUpperCase();
}
