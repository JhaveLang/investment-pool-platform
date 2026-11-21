import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, daysInMonth, lastDayOfMonth } from "./calendar";
import {
  accrualStartForDeposit,
  calculatePeriodReturn,
  minimumTermEnd,
  payoutDeadline,
  sumCapitalDays,
  type CapitalChange,
} from "./returns";

const NOVEMBER_START = "2026-11-01";
const NOVEMBER_END = "2026-11-30";

describe("calendar helpers", () => {
  it.each([
    ["2026-02", 28],
    ["2028-02", 29],
    ["2026-10", 31],
    ["2026-11", 30],
  ])("%s has %i days", (month, expectedDays) => {
    expect(daysInMonth(month)).toBe(expectedDays);
  });

  it("rolls months over year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });

  it("is unaffected by daylight saving time", () => {
    // Berlin switches to winter time on 25 Oct 2026.
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("accrual rules", () => {
  it("starts returns on the 8th for a payment received on the 1st", () => {
    expect(accrualStartForDeposit("2026-11-01")).toBe("2026-11-08");
  });

  it("frees deposited capital 60 days after receipt", () => {
    expect(minimumTermEnd("2026-11-01")).toBe("2026-12-31");
  });

  it("expects payouts within 7 days", () => {
    expect(payoutDeadline("2026-11-20")).toBe("2026-11-27");
  });
});

describe("sumCapitalDays", () => {
  it("counts capital from before the period for every day", () => {
    const changes: CapitalChange[] = [{ effectiveOn: "2026-09-15", amountCents: 100_000 }];
    expect(sumCapitalDays(changes, NOVEMBER_START, NOVEMBER_END)).toBe(BigInt(100_000 * 30));
  });

  it("counts a deposit received on the 1st from the 8th: 23 earning days in November", () => {
    const changes: CapitalChange[] = [{ effectiveOn: accrualStartForDeposit("2026-11-01"), amountCents: 100_000 }];
    expect(sumCapitalDays(changes, NOVEMBER_START, NOVEMBER_END)).toBe(BigInt(100_000 * 23));
  });

  it("stops a withdrawal requested on the 20th after 19 earning days", () => {
    const changes: CapitalChange[] = [
      { effectiveOn: "2026-01-10", amountCents: 100_000 },
      { effectiveOn: "2026-11-20", amountCents: -100_000 },
    ];
    expect(sumCapitalDays(changes, NOVEMBER_START, NOVEMBER_END)).toBe(BigInt(100_000 * 19));
  });

  it("ignores changes that take effect after the period", () => {
    const changes: CapitalChange[] = [{ effectiveOn: "2026-12-01", amountCents: 100_000 }];
    expect(sumCapitalDays(changes, NOVEMBER_START, NOVEMBER_END)).toBe(BigInt(0));
  });

  it("nets out a rejected withdrawal whose refund shares its effective day", () => {
    const changes: CapitalChange[] = [
      { effectiveOn: "2026-10-01", amountCents: 50_000 },
      { effectiveOn: "2026-11-10", amountCents: -20_000 },
      { effectiveOn: "2026-11-10", amountCents: 20_000 },
    ];
    expect(sumCapitalDays(changes, NOVEMBER_START, NOVEMBER_END)).toBe(BigInt(50_000 * 30));
  });
});

describe("calculatePeriodReturn", () => {
  it("applies the full monthly rate to capital invested all month", () => {
    const capitalDays = BigInt(100_000 * 30);
    expect(calculatePeriodReturn(capitalDays, 23_500, 30)).toEqual({
      averageCapitalCents: 100_000,
      returnCents: 2_350,
    });
  });

  it("pro-rates by earning days: 23 of 30 days at 3 % on 1.000 €", () => {
    // 1.000 € × 3 % × 23/30 = 23,00 €
    expect(calculatePeriodReturn(BigInt(100_000 * 23), 30_000, 30).returnCents).toBe(2_300);
  });

  it("rounds half away from zero to the cent", () => {
    // 1.000 € × 1 % × 19/30 = 6,3333 € → 6,33 €
    expect(calculatePeriodReturn(BigInt(100_000 * 19), 10_000, 30).returnCents).toBe(633);
    // 100,00 € × 0,005 % = 0,005 € → 0,01 €
    expect(calculatePeriodReturn(BigInt(10_000 * 30), 50, 30).returnCents).toBe(1);
    expect(calculatePeriodReturn(BigInt(10_000 * 30), -50, 30).returnCents).toBe(-1);
  });

  it("books losses as negative returns", () => {
    expect(calculatePeriodReturn(BigInt(200_000 * 31), -15_000, 31).returnCents).toBe(-3_000);
  });

  it("returns nothing without earning capital", () => {
    expect(calculatePeriodReturn(BigInt(0), 23_500, 30)).toEqual({ averageCapitalCents: 0, returnCents: 0 });
  });

  it("stays exact for very large balances", () => {
    // 1 billion euros all month at 1,2345 %
    const capitalDays = BigInt(100_000_000_000 * 31);
    expect(calculatePeriodReturn(capitalDays, 12_345, 31).returnCents).toBe(1_234_500_000);
  });
});
