import { describe, expect, it } from "vitest";
import { limitViolation, poolNotice, withdrawalLimits } from "./pool-settings";
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
      depositMinCents: 100,
      depositMaxCents: 1_000_000,
      withdrawalMinCents: 100,
      withdrawalMaxCents: 1_000_000,
      noticeDe: "Wartung",
      noticeEn: null,
    });
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
