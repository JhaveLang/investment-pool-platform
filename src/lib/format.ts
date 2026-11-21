import { INTL_LOCALES, type Locale } from "@/i18n/config";

export const APP_TIME_ZONE = "Europe/Berlin";
export const APP_CURRENCY = "EUR";

/** Locale-specific formatting helpers. Amounts are integer cents. */
export type Formatter = {
  /** 123456 → "1.234,56 €" (de) / "€1,234.56" (en) */
  currency: (cents: number) => string;
  /** 100000 → "1.000 €" (de) / "€1,000" (en), for quick-add steps */
  wholeCurrency: (cents: number) => string;
  /** -5000 → "-50,00 €", 5000 → "+50,00 €" */
  signedCurrency: (cents: number) => string;
  /** 123456 → "1234,56" (de) / "1234.56" (en), for CSV cells that Excel should read as numbers */
  decimal: (cents: number) => string;
  /** → "19.11.2026, 14:32" (de) / "19 Nov 2026, 14:32" (en) */
  dateTime: (value: Date) => string;
  /** → "19.11.2026" (de) / "19 Nov 2026" (en) */
  date: (value: Date) => string;
  /** → "14:32" */
  time: (value: Date) => string;
  /** → "19.11.2026, 14:32:05", for exports */
  exportDateTime: (value: Date) => string;
  /** Calendar date string "2026-11-08" → "08.11.2026" (de) / "8 Nov 2026" (en) */
  calendarDate: (isoDate: string) => string;
  /** Month string "2026-10" → "Oktober 2026" (de) / "October 2026" (en) */
  month: (isoMonth: string) => string;
  /** Signed rate in parts per million: 23500 → "+2,35 %" (de) / "+2.35%" (en) */
  rate: (ratePpm: number) => string;
  /** Plain percentage: 2 → "2 %" (de) / "2%" (en) */
  percent: (value: number) => string;
};

/** Parses "2026-11-08" or "2026-10" as UTC midnight; formatters for these use the UTC time zone. */
function calendarToUtcDate(isoValue: string): Date {
  const [year, month, day = 1] = isoValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function createFormatter(locale: Locale): Formatter {
  const intlLocale = INTL_LOCALES[locale];
  // A fixed time zone keeps output identical regardless of the server's TZ.
  const currencyFormat = new Intl.NumberFormat(intlLocale, { style: "currency", currency: APP_CURRENCY });
  const wholeCurrencyFormat = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: APP_CURRENCY,
    maximumFractionDigits: 0,
  });
  const signedCurrencyFormat = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: APP_CURRENCY,
    signDisplay: "exceptZero",
  });
  const decimalFormat = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const dateTimeFormat = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  });
  const dateFormat = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: APP_TIME_ZONE });
  const timeFormat = new Intl.DateTimeFormat(intlLocale, { timeStyle: "short", timeZone: APP_TIME_ZONE });
  const exportDateTimeFormat = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: APP_TIME_ZONE,
  });
  // Calendar values carry no time of day; formatting them in UTC keeps the date unchanged.
  const calendarDateFormat = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "UTC" });
  const monthFormat = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric", timeZone: "UTC" });
  const rateFormat = new Intl.NumberFormat(intlLocale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    signDisplay: "exceptZero",
  });
  const percentFormat = new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 2 });

  return {
    currency: (cents) => currencyFormat.format(cents / 100),
    wholeCurrency: (cents) => wholeCurrencyFormat.format(Math.round(cents / 100)),
    // A true minus sign (U+2212) instead of the hyphen Intl uses for these locales.
    signedCurrency: (cents) => signedCurrencyFormat.format(cents / 100).replace("-", "\u2212"),
    decimal: (cents) => decimalFormat.format(cents / 100),
    dateTime: (value) => dateTimeFormat.format(value),
    date: (value) => dateFormat.format(value),
    time: (value) => timeFormat.format(value),
    exportDateTime: (value) => exportDateTimeFormat.format(value),
    calendarDate: (isoDate) => calendarDateFormat.format(calendarToUtcDate(isoDate)),
    month: (isoMonth) => monthFormat.format(calendarToUtcDate(isoMonth)),
    rate: (ratePpm) => rateFormat.format(ratePpm / 1_000_000),
    percent: (value) => percentFormat.format(value / 100),
  };
}

const formatterCache = new Map<Locale, Formatter>();

export function getFormatter(locale: Locale): Formatter {
  let formatter = formatterCache.get(locale);
  if (!formatter) {
    formatter = createFormatter(locale);
    formatterCache.set(locale, formatter);
  }
  return formatter;
}

// "sv-SE" formats dates as ISO (YYYY-MM-DD), used for file names.
const isoDateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: APP_TIME_ZONE });

/** → "2026-11-19" (calendar date in Berlin time, independent of the UI language) */
export function formatIsoDate(value: Date): string {
  return isoDateFormat.format(value);
}
