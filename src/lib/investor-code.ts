import { randomInt } from "node:crypto";

/** Upper-case letters without I and O (easily confused with 1 and 0). */
export const INVESTOR_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Investor ID shape: 2 digits, 2 letters, 2 digits, e.g. "01GR01". */
export const INVESTOR_CODE_PATTERN = /^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$/;

/** Generates an investor ID; `randomIndex(n)` must return an integer in [0, n). */
export function generateInvestorCode(randomIndex: (exclusiveMax: number) => number = randomInt): string {
  const digit = () => String(randomIndex(10));
  const letter = () => INVESTOR_CODE_LETTERS[randomIndex(INVESTOR_CODE_LETTERS.length)];
  return digit() + digit() + letter() + letter() + digit() + digit();
}

/** Prepares an admin search query for matching against investor IDs. */
export function normalizeInvestorCodeQuery(value: string): string {
  return value.trim().toUpperCase();
}
