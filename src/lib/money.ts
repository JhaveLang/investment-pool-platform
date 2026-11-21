import type { Locale } from "@/i18n/config";

export const MIN_TRANSACTION_CENTS = 100; // 1,00 €
export const MAX_TRANSACTION_CENTS = 100_000_000; // 1.000.000,00 €

type AmountNotation = {
  /** With thousands separators: "1.234,56" (de) / "1,234.56" (en) */
  grouped: RegExp;
  /** Without separators: "1234,56" (de) / "1234.56" (en) */
  plain: RegExp;
  /** The other separator followed by 1–2 digits can only be meant as decimals: "12.5" (de) / "12,5" (en) */
  alternateDecimal: RegExp;
  groupSeparator: string;
  decimalSeparator: string;
};

const amountNotations: Record<Locale, AmountNotation> = {
  de: {
    grouped: /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/,
    plain: /^\d{1,12}(?:,\d{1,2})?$/,
    alternateDecimal: /^\d{1,12}\.\d{1,2}$/,
    groupSeparator: ".",
    decimalSeparator: ",",
  },
  en: {
    grouped: /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/,
    plain: /^\d{1,12}(?:\.\d{1,2})?$/,
    alternateDecimal: /^\d{1,12},\d{1,2}$/,
    groupSeparator: ",",
    decimalSeparator: ".",
  },
};

/** Normalises a locale-formatted amount to "1234.56", or `null` if it isn't a valid amount. */
function toCanonicalDecimal(value: string, notation: AmountNotation): string | null {
  if (notation.grouped.test(value)) {
    return value.replaceAll(notation.groupSeparator, "").replace(notation.decimalSeparator, ".");
  }
  if (notation.plain.test(value)) {
    return value.replace(notation.decimalSeparator, ".");
  }
  if (notation.alternateDecimal.test(value)) {
    return value.replace(notation.groupSeparator, ".");
  }
  return null;
}

/**
 * Parses a user-entered euro amount into integer cents using string arithmetic only,
 * so no floating point rounding can creep into stored values.
 * Returns `null` when the input is not a valid amount in the given locale's notation.
 */
export function parseAmountToCents(input: string, locale: Locale): number | null {
  const compactValue = input.replace(/[\s €]/g, "");
  const canonicalValue = toCanonicalDecimal(compactValue, amountNotations[locale]);
  if (canonicalValue === null) {
    return null;
  }

  const [wholePart, fractionPart = ""] = canonicalValue.split(".");
  const totalCents = Number(wholePart) * 100 + Number(fractionPart.padEnd(2, "0"));
  return Number.isSafeInteger(totalCents) ? totalCents : null;
}

// Rates never need thousands separators, so both "," and "." are accepted as the decimal mark.
const PERCENT_PATTERN = /^([+-]?)(\d{1,4})(?:[.,](\d{1,4}))?$/;

/**
 * Parses a percentage such as "2,35", "-0,5 %" or "+1.25" into integer parts per million
 * (2,35 % → 23 500), with up to four decimals. Returns `null` for anything else.
 */
export function parsePercentToPpm(input: string): number | null {
  const compactValue = input.replace(/[\s%]/g, "").replace("−", "-");
  const match = PERCENT_PATTERN.exec(compactValue);
  if (!match) {
    return null;
  }
  const [, sign, wholePart, fractionPart = ""] = match;
  const magnitude = Number(wholePart) * 10_000 + Number(fractionPart.padEnd(4, "0"));
  return sign === "-" ? -magnitude : magnitude;
}
