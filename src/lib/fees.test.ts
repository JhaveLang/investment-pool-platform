import { describe, expect, it } from "vitest";
import {
  depositCreditCents,
  depositFeeCents,
  maxWithdrawalPayoutCents,
  withdrawalDebitCents,
  withdrawalFeeCents,
} from "./fees";

describe("deposit fees", () => {
  it.each([
    ["bank_transfer", 100_000, 98_000],
    ["crypto", 100_000, 100_000],
    ["exchange", 100_000, 97_000],
  ] as const)("credits a %s deposit of %i cents with %i cents", (method, amountCents, creditedCents) => {
    expect(depositCreditCents(amountCents, method)).toBe(creditedCents);
    expect(depositFeeCents(amountCents, method)).toBe(amountCents - creditedCents);
  });

  it("rounds the fee down to the cent", () => {
    // 2 % of 1.000,01 € is 20,0002 € → 20,00 € fee, 980,01 € credited.
    expect(depositFeeCents(100_001, "bank_transfer")).toBe(2_000);
    expect(depositCreditCents(100_001, "bank_transfer")).toBe(98_001);
  });
});

describe("withdrawal fees", () => {
  it("debits 1.020,40 € for a 1.000,00 € bank payout (1.000 ÷ 0,98)", () => {
    expect(withdrawalDebitCents(100_000, "bank_transfer")).toBe(102_040);
    expect(withdrawalFeeCents(100_000, "bank_transfer")).toBe(2_040);
  });

  it("debits 1.030,92 € for a 1.000,00 € payout to an exchange (1.000 ÷ 0,97)", () => {
    expect(withdrawalDebitCents(100_000, "exchange")).toBe(103_092);
    expect(withdrawalFeeCents(100_000, "exchange")).toBe(3_092);
  });

  it("charges nothing for crypto payouts", () => {
    expect(withdrawalDebitCents(100_000, "crypto")).toBe(100_000);
    expect(withdrawalFeeCents(100_000, "crypto")).toBe(0);
  });

  it("keeps the payout at (100 − fee) % of the debit when that divides evenly", () => {
    expect(withdrawalDebitCents(98_000, "bank_transfer")).toBe(100_000);
    expect(withdrawalDebitCents(97_000, "exchange")).toBe(100_000);
  });
});

describe("maxWithdrawalPayoutCents", () => {
  it.each([
    ["bank_transfer", 102_040, 100_000],
    ["exchange", 103_092, 100_000],
    ["crypto", 100_000, 100_000],
    ["bank_transfer", 0, 0],
  ] as const)("pays out at most %s from %i cents available: %i", (method, availableCents, expectedPayout) => {
    expect(maxWithdrawalPayoutCents(availableCents, method)).toBe(expectedPayout);
  });

  it("always fits the debit into the available amount", () => {
    for (const method of ["bank_transfer", "exchange"] as const) {
      for (let availableCents = 1; availableCents <= 5_000; availableCents += 7) {
        const payoutCents = maxWithdrawalPayoutCents(availableCents, method);
        expect(withdrawalDebitCents(payoutCents, method)).toBeLessThanOrEqual(availableCents);
        expect(withdrawalDebitCents(payoutCents + 1, method)).toBeGreaterThan(availableCents);
      }
    }
  });
});
