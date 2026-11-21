import { describe, expect, it } from "vitest";
import {
  generateInvestorCode,
  INVESTOR_CODE_LETTERS,
  INVESTOR_CODE_PATTERN,
  normalizeInvestorCodeQuery,
} from "./investor-code";

describe("generateInvestorCode", () => {
  it("matches the 2-digit, 2-letter, 2-digit shape", () => {
    for (let round = 0; round < 500; round += 1) {
      expect(generateInvestorCode()).toMatch(/^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$/);
    }
  });

  it("never uses I or O", () => {
    expect(INVESTOR_CODE_LETTERS).not.toMatch(/[IO]/);
    expect(INVESTOR_CODE_LETTERS).toHaveLength(24);
  });

  it("builds the code from the injected random source", () => {
    const sequence = [0, 1, 6, 15, 0, 1]; // digits 0,1 · letters G (6), R (15 – I and O are skipped) · digits 0,1
    expect(generateInvestorCode(() => sequence.shift()!)).toBe("01GR01");
  });

  it("covers the lowest and highest values", () => {
    expect(generateInvestorCode((max) => max - 1)).toBe("99ZZ99");
    expect(generateInvestorCode(() => 0)).toBe("00AA00");
  });
});

describe("INVESTOR_CODE_PATTERN", () => {
  it("rejects I/O and wrong shapes", () => {
    for (const bad of ["01IO01", "1GR01", "01GR1", "01gr01", "01GR012"]) {
      expect(INVESTOR_CODE_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe("normalizeInvestorCodeQuery", () => {
  it("trims and upper-cases", () => {
    expect(normalizeInvestorCodeQuery(" 01gr01 ")).toBe("01GR01");
  });
});
