const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** Removes spaces and upper-cases, e.g. "de89 3704 ..." → "DE893704...". */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Validates structure and the ISO 13616 mod-97 checksum. */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!IBAN_PATTERN.test(iban)) {
    return false;
  }

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numericIban = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));

  let remainder = 0;
  for (const digit of numericIban) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** "DE89370400440532013000" → "DE89 3704 0044 0532 0130 00" */
export function formatIban(value: string): string {
  return normalizeIban(value)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** Where a payout goes: the IBAN in groups of four for bank transfers, otherwise the wallet address as entered. */
export function formatPayoutDestination(destination: { iban: string | null; walletAddress: string | null }): string {
  return destination.iban ? formatIban(destination.iban) : (destination.walletAddress ?? "");
}
