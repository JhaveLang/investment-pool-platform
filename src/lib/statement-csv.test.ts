import { describe, expect, it } from "vitest";
import { de } from "@/i18n/messages/de";
import { en } from "@/i18n/messages/en";
import { getFormatter } from "./format";
import {
  MAX_EXPORT_MONTHS,
  buildInvestorStatementCsv,
  buildInvestorsStatementCsv,
  monthsBetween,
  parseExportMonthRange,
} from "./statement-csv";
import type { MonthStatement } from "./statements";

const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

// Ben from the client's balance rules: 10.000 € on 1 Oct, +250 € return, 5.000 € withdrawn on 20 Oct (with fee),
// an open deposit in November.
const october: MonthStatement = {
  month: "2026-10",
  openingCents: 1_000_000,
  closingCents: 525_000,
  returnCents: 25_000,
  movements: [
    {
      kind: "withdrawal",
      status: "approved",
      reference: "AZ-1",
      valueDate: "2026-10-20",
      amountCents: -500_000,
      pending: false,
      booked: true,
    },
  ],
};
const november: MonthStatement = {
  month: "2026-11",
  openingCents: 525_000,
  closingCents: 632_400,
  returnCents: null,
  movements: [
    {
      kind: "deposit",
      status: "pending",
      reference: "EZ-2",
      valueDate: "2026-11-23",
      amountCents: 98_000,
      pending: true,
      booked: false,
    },
    {
      kind: "deposit",
      status: "reconciled",
      reference: "EZ-1",
      valueDate: "2026-11-02",
      amountCents: 107_400,
      pending: false,
      booked: true,
    },
  ],
};
const empty: MonthStatement = { month: "2026-09", openingCents: null, closingCents: null, returnCents: null, movements: [] };

describe("buildInvestorsStatementCsv", () => {
  it("puts three columns per month side by side, oldest month first", () => {
    const csv = buildInvestorsStatementCsv(
      [{ investorCode: "42TN03", fullName: "Ben", statusLabel: "Aktiv", statements: [empty, october, november] }],
      ["2026-09", "2026-10", "2026-11"],
      de.csv,
      getFormatter("de"),
      ";",
    );
    expect(lines(csv)).toEqual([
      "Anleger-ID;Anleger;Status;Anlage am 1. Sept. 2026 (EUR);Rendite Sept. 2026 (EUR);Sonstiges Sept. 2026;" +
        "Anlage am 1. Okt. 2026 (EUR);Rendite Okt. 2026 (EUR);Sonstiges Okt. 2026;" +
        "Anlage am 1. Nov. 2026 (EUR);Rendite Nov. 2026 (EUR);Sonstiges Nov. 2026;Gebuchter Endsaldo (EUR)",
      "42TN03;Ben;Aktiv;;;;10000,00;250,00;20.10.2026: -5000,00;5250,00;;02.11.2026: +1074,00 · 23.11.2026: +980,00 (offen);6324,00",
    ]);
  });

  it("uses the English formats and quotes cells containing the delimiter", () => {
    const csv = buildInvestorsStatementCsv(
      [{ investorCode: "42TN03", fullName: "Berger, Ben", statusLabel: "Active", statements: [october] }],
      ["2026-10"],
      en.csv,
      getFormatter("en"),
      ",",
    );
    expect(lines(csv)).toEqual([
      "Investor ID,Investor,Status,Investment on 1 Oct 2026 (EUR),Return Oct 2026 (EUR),Miscellaneous Oct 2026,Booked closing balance (EUR)",
      '42TN03,"Berger, Ben",Active,10000.00,250.00,20 Oct 2026: -5000.00,5250.00',
    ]);
  });
});

describe("buildInvestorStatementCsv", () => {
  it("identifies the month with a difference in both exports even without itemized movements", () => {
    const statement = { ...empty, closingCents: 500 };
    const investor = { investorCode: "42TN03", fullName: "Ben", statusLabel: "Active", statements: [statement] };
    const format = getFormatter("en");
    const warning = en.csv.reviewDifference(format.signedCurrency(500));
    expect(buildInvestorStatementCsv(investor, [statement], en.csv, format, ",")).toContain(warning);
    expect(buildInvestorsStatementCsv([investor], [statement.month], en.csv, format, ",")).toContain(warning);
  });

  it("writes one row per month and sums only booked deposits and withdrawals", () => {
    const csv = buildInvestorStatementCsv(
      { investorCode: "42TN03", fullName: "Ben" },
      [october, november],
      de.csv,
      getFormatter("de"),
      ";",
    );
    expect(lines(csv)).toEqual([
      "Anleger-ID;Anleger;Monat;Anlage am 1. (EUR);Rendite (EUR);Einzahlungen (EUR);Auszahlungen (EUR);Sonstiges;Gebuchter Endsaldo (EUR)",
      "42TN03;Ben;Oktober 2026;10000,00;250,00;;-5000,00;20.10.2026: -5000,00;5250,00",
      "42TN03;Ben;November 2026;5250,00;;1074,00;;02.11.2026: +1074,00 · 23.11.2026: +980,00 (offen);6324,00",
    ]);
  });
});

describe("parseExportMonthRange", () => {
  const current = "2026-11";

  it("defaults to the given start and the current month", () => {
    expect(parseExportMonthRange({}, current, "2026-08")).toEqual({ from: "2026-08", to: "2026-11" });
    expect(parseExportMonthRange({}, current, null)).toEqual({ from: "2026-11", to: "2026-11" });
    expect(parseExportMonthRange({ to: "2026-09" }, current, "2026-10")).toEqual({ from: "2026-09", to: "2026-09" });
  });

  it("takes an explicit range and puts swapped months in order", () => {
    expect(parseExportMonthRange({ from: "2026-09", to: "2026-10" }, current, null)).toEqual({
      from: "2026-09",
      to: "2026-10",
    });
    expect(parseExportMonthRange({ from: "2026-11", to: "2026-09" }, current, null)).toEqual({
      from: "2026-09",
      to: "2026-11",
    });
  });

  it("refuses malformed and future months and overlong explicit ranges, but clamps the default start", () => {
    expect(parseExportMonthRange({ from: "2026-13" }, current, null)).toBeNull();
    expect(parseExportMonthRange({ to: "Nov" }, current, null)).toBeNull();
    expect(parseExportMonthRange({ to: "2026-12" }, current, null)).toBeNull();
    expect(parseExportMonthRange({ from: "2026-12", to: "2026-10" }, current, null)).toBeNull();
    expect(parseExportMonthRange({ from: "2020-01" }, current, null)).toBeNull();
    const clamped = parseExportMonthRange({}, current, "2015-01");
    expect(clamped && monthsBetween(clamped)).toHaveLength(MAX_EXPORT_MONTHS);
  });
});
