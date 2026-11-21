import { describe, expect, it } from "vitest";
import { getSchemas } from "./validation";

const {
  depositSchema,
  withdrawalSchema,
  reconcileSchema,
  returnPreviewSchema,
  bookReturnSchema,
  changePasswordSchema,
  adminUpdateInvestorSchema,
  adminSetPasswordSchema,
} = getSchemas("de");
const IDEMPOTENCY_KEY = "3f1b6f0e-8f4f-4a39-9d1c-3c1f6c0b2a11";
const WALLET = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

/** Field the first issue is reported on, as `validationErrorState` keys it. */
function failedField(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.success ? null : String(result.error?.issues[0]?.path[0] ?? "form");
}

describe("depositSchema", () => {
  it("accepts every payment method", () => {
    for (const method of ["bank_transfer", "crypto", "exchange"]) {
      expect(depositSchema.safeParse({ amount: "1.000,00", method, idempotencyKey: IDEMPOTENCY_KEY }).success).toBe(
        true,
      );
    }
  });

  it("reports an unknown method on the method field", () => {
    const result = depositSchema.safeParse({ amount: "100", method: "cash", idempotencyKey: IDEMPOTENCY_KEY });
    expect(failedField(result)).toBe("method");
  });
});

describe("withdrawalSchema", () => {
  it("accepts a bank payout and normalises the IBAN", () => {
    const result = withdrawalSchema.safeParse({
      method: "bank_transfer",
      amount: "500",
      iban: "de89 3704 0044 0532 0130 00",
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(result.success && result.data).toEqual({
      method: "bank_transfer",
      amount: 50_000,
      iban: "DE89370400440532013000",
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it.each(["crypto", "exchange"])("accepts a %s payout to a wallet address", (method) => {
    const result = withdrawalSchema.safeParse({
      method,
      amount: "500",
      walletAddress: ` ${WALLET} `,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(result.success && result.data).toEqual({
      method,
      amount: 50_000,
      walletAddress: WALLET,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it("requires an IBAN for bank payouts", () => {
    const result = withdrawalSchema.safeParse({
      method: "bank_transfer",
      amount: "500",
      walletAddress: WALLET,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(failedField(result)).toBe("iban");
  });

  it("requires a valid wallet address for crypto payouts", () => {
    const missing = withdrawalSchema.safeParse({
      method: "crypto",
      amount: "500",
      iban: "DE89370400440532013000",
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(failedField(missing)).toBe("walletAddress");
    const tooShort = withdrawalSchema.safeParse({
      method: "crypto",
      amount: "500",
      walletAddress: "abc",
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(failedField(tooShort)).toBe("walletAddress");
  });

  it("reports a tampered method on the method field", () => {
    const result = withdrawalSchema.safeParse({
      method: "cash",
      amount: "500",
      iban: "DE89370400440532013000",
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(failedField(result)).toBe("method");
  });
});

describe("reconcileSchema", () => {
  const recordId = "6c9f0a52-6f0e-4d0b-a7a1-0c1c1d6e9a10";

  it("accepts an ISO receipt date", () => {
    expect(reconcileSchema.safeParse({ recordId, note: "", receivedOn: "2026-11-03" }).success).toBe(true);
  });

  it.each(["", "03.11.2026", "2026-13-01"])("rejects the receipt date %j", (receivedOn) => {
    expect(failedField(reconcileSchema.safeParse({ recordId, note: "", receivedOn }))).toBe("receivedOn");
  });
});

describe("monthly return schemas", () => {
  it("parses month and rate for the preview", () => {
    expect(returnPreviewSchema.safeParse({ month: "2026-10", rate: "-0,8" }).data).toEqual({
      month: "2026-10",
      rate: -8_000,
    });
  });

  it.each([
    [{ month: "2026-13", rate: "1" }, "month"],
    [{ month: "2026-10", rate: "abc" }, "rate"],
    [{ month: "2026-10", rate: "-100" }, "rate"],
    [{ month: "2026-10", rate: "100,01" }, "rate"],
  ])("rejects %j on %s", (input, field) => {
    expect(failedField(returnPreviewSchema.safeParse(input))).toBe(field);
  });

  it("coerces the confirmed total when booking", () => {
    const result = bookReturnSchema.safeParse({ month: "2026-10", rate: "2,5", expectedTotalCents: "-44460" });
    expect(result.data).toEqual({ month: "2026-10", rate: 25_000, expectedTotalCents: -44_460 });
  });

  it("rejects a tampered total", () => {
    expect(failedField(bookReturnSchema.safeParse({ month: "2026-10", rate: "2,5", expectedTotalCents: "1.5" }))).toBe(
      "expectedTotalCents",
    );
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    currentPassword: "old-password-1",
    newPassword: "new-password-1",
    newPasswordConfirmation: "new-password-1",
  };
  it("accepts a valid change", () => expect(changePasswordSchema.safeParse(valid).success).toBe(true));
  it("flags a mismatch on the confirmation", () =>
    expect(failedField(changePasswordSchema.safeParse({ ...valid, newPasswordConfirmation: "x".repeat(12) }))).toBe(
      "newPasswordConfirmation",
    ));
  it("flags a short new password", () =>
    expect(
      failedField(changePasswordSchema.safeParse({ ...valid, newPassword: "short", newPasswordConfirmation: "short" })),
    ).toBe("newPassword"));
  it("rejects reusing the current password", () =>
    expect(
      failedField(
        changePasswordSchema.safeParse({
          ...valid,
          newPassword: valid.currentPassword,
          newPasswordConfirmation: valid.currentPassword,
        }),
      ),
    ).toBe("newPassword"));
  it("requires the current password", () =>
    expect(failedField(changePasswordSchema.safeParse({ ...valid, currentPassword: "" }))).toBe("currentPassword"));
});

describe("adminUpdateInvestorSchema", () => {
  it("trims and lower-cases the email", () => {
    const result = adminUpdateInvestorSchema.safeParse({
      userId: IDEMPOTENCY_KEY,
      fullName: " Anna Schmidt ",
      email: " Anna@Example.DE ",
    });
    expect(result.success && result.data).toMatchObject({ fullName: "Anna Schmidt", email: "anna@example.de" });
  });
  it("rejects a non-uuid user id", () =>
    expect(
      failedField(adminUpdateInvestorSchema.safeParse({ userId: "abc", fullName: "Anna Schmidt", email: "a@b.de" })),
    ).toBe("userId"));
});

describe("adminSetPasswordSchema", () => {
  it("flags a mismatch on the confirmation", () =>
    expect(
      failedField(
        adminSetPasswordSchema.safeParse({
          userId: IDEMPOTENCY_KEY,
          newPassword: "a".repeat(10),
          newPasswordConfirmation: "b".repeat(10),
        }),
      ),
    ).toBe("newPasswordConfirmation"));
});
