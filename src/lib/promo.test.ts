import { describe, expect, it } from "vitest";
import { availableForFixedIncomesCents, isPromoBookable, maxPromoBookingCents } from "./promo";

const pool = { balanceCents: 562_756, lockedCents: 0, reservedCents: 0, pendingPromoCents: 0 };

describe("Fixed Incomes offer availability", () => {
  const offer = { visible: true, bookingUntil: "2026-11-27", details: "Example: €1,000 earns €20." };

  it("allows a visible offer with example text through its booking deadline", () => {
    expect(isPromoBookable(offer, "2026-11-27")).toBe(true);
    expect(isPromoBookable(offer, "2026-11-28")).toBe(false);
  });

  it("excludes hidden offers even before the deadline", () => {
    expect(isPromoBookable({ ...offer, visible: false }, "2026-11-26")).toBe(false);
  });
});

describe("funds available for Fixed Incomes", () => {
  it("keeps one reserve and rounds down to the last whole euro", () => {
    expect(availableForFixedIncomesCents(pool)).toBe(462_700);
  });

  it("excludes locked deposits, pending withdrawals and pending bookings before keeping the reserve", () => {
    expect(availableForFixedIncomesCents({
      ...pool, lockedCents: 200_000, reservedCents: 12_750, pendingPromoCents: 50_000,
    })).toBe(200_000);
  });

  it("shows zero when all funds are locked or less than a whole euro remains after the reserve", () => {
    expect(availableForFixedIncomesCents({ ...pool, lockedCents: pool.balanceCents })).toBe(0);
    expect(availableForFixedIncomesCents({ ...pool, balanceCents: 100_099 })).toBe(0);
    expect(availableForFixedIncomesCents({ ...pool, balanceCents: 100_100 })).toBe(100);
  });

  it("applies an offer's limits only when calculating that booking", () => {
    const offer = { minDepositCents: 100_000, maxDepositCents: 250_000 };
    expect(maxPromoBookingCents(offer, pool)).toBe(250_000);
    const belowMinimum = { ...pool, balanceCents: 199_999 };
    expect(availableForFixedIncomesCents(belowMinimum)).toBe(99_900);
    expect(maxPromoBookingCents(offer, belowMinimum)).toBe(0);
    expect(maxPromoBookingCents(offer, { ...pool, balanceCents: 200_000 })).toBe(100_000);
  });
});
