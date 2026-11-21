import { describe, expect, it } from "vitest";
import { formatIban, isValidIban, normalizeIban } from "./iban";

describe("iban", () => {
  it("accepts valid IBANs regardless of spacing and case", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("de89370400440532013000")).toBe(true);
    expect(isValidIban("AT61 1904 3002 3457 3201")).toBe(true);
  });

  it("rejects wrong checksums and malformed values", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 01")).toBe(false);
    expect(isValidIban("DE89")).toBe(false);
    expect(isValidIban("1234567890")).toBe(false);
  });

  it("normalizes and formats", () => {
    expect(normalizeIban(" de89 3704 0044 ")).toBe("DE8937040044");
    expect(formatIban("DE89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});
