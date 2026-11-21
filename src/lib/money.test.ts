import { describe, expect, it } from "vitest";
import { parseAmountToCents, parsePercentToPpm } from "./money";

describe("parsePercentToPpm", () => {
  it.each([
    ["2,35", 23_500],
    ["2.35", 23_500],
    ["+2,35 %", 23_500],
    ["-0,5", -5_000],
    ["−1,25%", -12_500],
    ["0", 0],
    ["1,2345", 12_345],
    ["100", 1_000_000],
  ])("parses %j as %i ppm", (input, expectedPpm) => {
    expect(parsePercentToPpm(input)).toBe(expectedPpm);
  });

  it.each(["", "abc", "1,23456", "2,", "--1", "1.000,5", "1e2"])("rejects %j", (input) => {
    expect(parsePercentToPpm(input)).toBeNull();
  });
});

describe("parseAmountToCents (German notation)", () => {
  it.each([
    ["100", 10_000],
    ["100,5", 10_050],
    ["100,50", 10_050],
    ["1.234", 123_400],
    ["1.234,56", 123_456],
    ["1.000.000,00", 100_000_000],
    ["1234.56", 123_456],
    ["0,01", 1],
    [" 250,00 € ", 25_000],
  ])("parses %j as %i cents", (input, expectedCents) => {
    expect(parseAmountToCents(input, "de")).toBe(expectedCents);
  });

  it.each(["", "abc", "-5", "1,234", "12,345", "1.23.4", "1.2345", "10,", "1e5", "1.234.56"])(
    "rejects %j",
    (input) => {
      expect(parseAmountToCents(input, "de")).toBeNull();
    },
  );
});

describe("parseAmountToCents (English notation)", () => {
  it.each([
    ["100", 10_000],
    ["100.5", 10_050],
    ["1,234", 123_400],
    ["1,234.56", 123_456],
    ["1,000,000.00", 100_000_000],
    ["1234,56", 123_456],
    ["€ 250.00", 25_000],
  ])("parses %j as %i cents", (input, expectedCents) => {
    expect(parseAmountToCents(input, "en")).toBe(expectedCents);
  });

  it.each(["", "1.234", "1,234,56", "1,2345", "10.", "1.234,56"])("rejects %j", (input) => {
    expect(parseAmountToCents(input, "en")).toBeNull();
  });
});
