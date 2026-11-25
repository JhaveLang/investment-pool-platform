import { describe, expect, it } from "vitest";
import { depositState, limitViolation, poolNotice, withdrawalLimits } from "./pool-settings";
import { getSchemas } from "./validation";

describe("limitViolation", () => {
  const limits = { minCents: 10_000, maxCents: 1_000_000 };

  it("allows both limits themselves", () => {
    expect(limitViolation(10_000, limits)).toBeNull();
    expect(limitViolation(1_000_000, limits)).toBeNull();
  });

  it("names the side that was missed by a cent", () => {
    expect(limitViolation(9_999, limits)).toBe("tooSmall");
    expect(limitViolation(1_000_001, limits)).toBe("tooLarge");
  });
});

describe("depositState", () => {
  const settings = { depositsOpen: true, depositsFrom: "2026-12-01", depositsUntil: "2026-12-31" };

  it("is open on the first and the last day", () => {
    expect(depositState(settings, "2026-12-01")).toBe("open");
    expect(depositState(settings, "2026-12-31")).toBe("open");
  });

  it("tells the day before the first from the day after the last", () => {
    expect(depositState(settings, "2026-11-30")).toBe("notYet");
    expect(depositState(settings, "2027-01-01")).toBe("ended");
  });

  it("has no limit on a side without a date", () => {
    expect(depositState({ ...settings, depositsFrom: null }, "2020-01-01")).toBe("open");
    expect(depositState({ ...settings, depositsUntil: null }, "2030-01-01")).toBe("open");
    expect(depositState({ ...settings, depositsFrom: null, depositsUntil: null }, "2026-12-15")).toBe("open");
  });

  it("stays closed while the admin has closed it, whatever the dates say", () => {
    expect(depositState({ ...settings, depositsOpen: false }, "2026-12-15")).toBe("closed");
    expect(depositState({ ...settings, depositsOpen: false }, "2026-11-30")).toBe("closed");
  });
});

describe("withdrawalLimits", () => {
  const settings = { withdrawalMinCents: 10_000, withdrawalMaxCents: 1_000_000 };

  it("uses the settings while enough is available", () => {
    expect(withdrawalLimits(settings, 5_000_000, "crypto")).toEqual({ minCents: 10_000, maxCents: 1_000_000 });
  });

  it("lets an investor with less than the minimum take out all of it, fee included", () => {
    expect(withdrawalLimits(settings, 4_000, "crypto").minCents).toBe(4_000);
    // 40,00 € pay out 39,20 € by bank (2 % fee on top).
    expect(withdrawalLimits(settings, 4_000, "bank_transfer").minCents).toBe(3_920);
  });

  it("doesn't call a repeated submit too small once everything was taken out", () => {
    expect(withdrawalLimits(settings, 0, "crypto").minCents).toBe(100);
    expect(withdrawalLimits(settings, 99, "crypto").minCents).toBe(100);
  });
});

describe("poolNotice", () => {
  it("shows the visitor's language and falls back to the other one", () => {
    expect(poolNotice({ noticeDe: "Hallo", noticeEn: "Hello" }, "en")).toBe("Hello");
    expect(poolNotice({ noticeDe: "Hallo", noticeEn: null }, "en")).toBe("Hallo");
    expect(poolNotice({ noticeDe: null, noticeEn: "Hello" }, "de")).toBe("Hello");
    expect(poolNotice({ noticeDe: null, noticeEn: null }, "de")).toBeNull();
  });
});

describe("poolSettingsSchema", () => {
  const { poolSettingsSchema } = getSchemas("de");
  const valid = {
    depositsOpen: true,
    depositsFrom: "",
    depositsUntil: "",
    depositMin: "1,00",
    depositMax: "10.000,00",
    withdrawalMin: "1,00",
    withdrawalMax: "10.000,00",
    noticeDe: "",
    noticeEn: "",
  };
  const failedFields = (values: Partial<Record<keyof typeof valid, unknown>>) => {
    const result = poolSettingsSchema.safeParse({ ...valid, ...values });
    return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
  };

  it("reads amounts as cents and empty notices as none", () => {
    expect(poolSettingsSchema.parse({ ...valid, depositsOpen: false, noticeDe: "  Wartung  " })).toEqual({
      depositsOpen: false,
      depositsFrom: null,
      depositsUntil: null,
      depositMinCents: 100,
      depositMaxCents: 1_000_000,
      withdrawalMinCents: 100,
      withdrawalMaxCents: 1_000_000,
      noticeDe: "Wartung",
      noticeEn: null,
    });
  });

  it("keeps the deposit dates, also in the past", () => {
    const dates = { depositsFrom: "2020-01-01", depositsUntil: "2020-01-31" };
    expect(poolSettingsSchema.parse({ ...valid, ...dates })).toMatchObject(dates);
  });

  it("refuses a last deposit day before the first, on the last day", () => {
    expect(failedFields({ depositsFrom: "2026-12-02", depositsUntil: "2026-12-01" })).toEqual(["depositsUntil"]);
    expect(failedFields({ depositsFrom: "2026-12-01", depositsUntil: "2026-12-01" })).toEqual([]);
    expect(failedFields({ depositsFrom: "2026-12-01" })).toEqual([]);
    expect(failedFields({ depositsUntil: "2026-12-01" })).toEqual([]);
  });

  it("refuses dates that don't exist", () => {
    expect(failedFields({ depositsFrom: "2026-02-30" })).toEqual(["depositsFrom"]);
    expect(failedFields({ depositsUntil: "bald" })).toEqual(["depositsUntil"]);
  });

  it("refuses a minimum above its maximum, on the maximum", () => {
    expect(failedFields({ depositMin: "500", depositMax: "499,99" })).toEqual(["depositMax"]);
    expect(failedFields({ depositMin: "500", depositMax: "500" })).toEqual([]);
  });

  it("keeps withdrawals possible: minimum at most 100 €, maximum at least 1.000 €", () => {
    expect(failedFields({ withdrawalMin: "100", withdrawalMax: "1.000" })).toEqual([]);
    expect(failedFields({ withdrawalMin: "100,01" })).toEqual(["withdrawalMin"]);
    expect(failedFields({ withdrawalMax: "999,99" })).toEqual(["withdrawalMax"]);
  });

  it("refuses amounts outside 1 € – 1.000.000 €, text that is no amount, and long notices", () => {
    expect(failedFields({ depositMin: "0,99" })).toEqual(["depositMin"]);
    expect(failedFields({ depositMax: "1.000.000,01" })).toEqual(["depositMax"]);
    expect(failedFields({ depositMax: "viel" })).toEqual(["depositMax"]);
    expect(failedFields({ noticeDe: "x".repeat(500) })).toEqual([]);
    expect(failedFields({ noticeEn: "x".repeat(501) })).toEqual(["noticeEn"]);
  });
});
