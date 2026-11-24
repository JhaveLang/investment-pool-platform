import { describe, expect, it } from "vitest";
import { getSchemas, MAX_INVESTOR_CODE_CHANGES } from "./validation";

const {
  depositSchema,
  withdrawalSchema,
  reconcileSchema,
  returnPreviewSchema,
  bookReturnSchema,
  changePasswordSchema,
  createInvestorSchema,
  adminUpdateInvestorSchema,
  adminInvestorCodesSchema,
  adminSetPasswordSchema,
  adminInvestorStatusSchema,
  newsEntrySchema,
  newsIdSchema,
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
  const valid = { userId: IDEMPOTENCY_KEY, fullName: "Anna Schmidt", email: "a@b.de", investorCode: "01GR01" };

  it("trims and lower-cases the email", () => {
    const result = adminUpdateInvestorSchema.safeParse({
      ...valid,
      fullName: " Anna Schmidt ",
      email: " Anna@Example.DE ",
    });
    expect(result.success && result.data).toMatchObject({ fullName: "Anna Schmidt", email: "anna@example.de" });
  });
  it("rejects a non-uuid user id", () =>
    expect(failedField(adminUpdateInvestorSchema.safeParse({ ...valid, userId: "abc" }))).toBe("userId"));
  it("trims and upper-cases the investor ID", () => {
    const result = adminUpdateInvestorSchema.safeParse({ ...valid, investorCode: " 07km42 " });
    expect(result.success && result.data.investorCode).toBe("07KM42");
  });
  it("accepts free-form IDs of 6 to 20 letters, digits and hyphens", () => {
    for (const investorCode of ["123456", "01IO01", "inv-0042", "KUNDE2024", "A".repeat(20)]) {
      const result = adminUpdateInvestorSchema.safeParse({ ...valid, investorCode });
      expect(result.success && result.data.investorCode).toBe(investorCode.toUpperCase());
    }
  });
  it("rejects a malformed investor ID", () => {
    for (const investorCode of ["", "  ", "12345", "A".repeat(21), "07KM 42", "INV_0042", "ÄBCDEF"]) {
      expect(failedField(adminUpdateInvestorSchema.safeParse({ ...valid, investorCode }))).toBe("investorCode");
    }
  });
  it("reports why an investor ID is refused: empty, too short or too long", () => {
    const firstMessage = (investorCode: string) => {
      const result = adminUpdateInvestorSchema.safeParse({ ...valid, investorCode });
      return result.success ? null : result.error.issues[0]?.message;
    };
    expect(firstMessage(" ")).toBe("Dieses Feld ist erforderlich.");
    expect(firstMessage("12345")).toBe("Die Anleger-ID muss mindestens 6 Zeichen lang sein.");
    expect(firstMessage("A".repeat(21))).toBe("Die Anleger-ID darf höchstens 20 Zeichen lang sein.");
  });
});

describe("adminInvestorCodesSchema", () => {
  const ANNA = "3f1b6f0e-8f4f-4a39-9d1c-3c1f6c0b2a12";
  const BEN = "3f1b6f0e-8f4f-4a39-9d1c-3c1f6c0b2a13";
  /** "index.field" of every issue, e.g. "1.investorCode". */
  const issuePaths = (result: ReturnType<typeof adminInvestorCodesSchema.safeParse>) =>
    result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));

  it("upper-cases several IDs at once", () => {
    const result = adminInvestorCodesSchema.safeParse([
      { userId: ANNA, investorCode: " 07km42 " },
      { userId: BEN, investorCode: "12AB34" },
    ]);
    expect(result.success && result.data).toEqual([
      { userId: ANNA, investorCode: "07KM42" },
      { userId: BEN, investorCode: "12AB34" },
    ]);
  });
  it("marks a malformed ID on its own row", () =>
    expect(
      issuePaths(
        adminInvestorCodesSchema.safeParse([
          { userId: ANNA, investorCode: "07KM42" },
          { userId: BEN, investorCode: "07KM 42" },
        ]),
      ),
    ).toEqual(["1.investorCode"]));
  it("marks both rows when the same ID is entered twice, regardless of case", () =>
    expect(
      issuePaths(
        adminInvestorCodesSchema.safeParse([
          { userId: ANNA, investorCode: "07KM42" },
          { userId: BEN, investorCode: "07km42" },
        ]),
      ),
    ).toEqual(["0.investorCode", "1.investorCode"]));
  it("rejects an empty batch and a non-uuid user id", () => {
    expect(adminInvestorCodesSchema.safeParse([]).success).toBe(false);
    expect(issuePaths(adminInvestorCodesSchema.safeParse([{ userId: "abc", investorCode: "07KM42" }]))).toEqual([
      "0.userId",
    ]);
  });
  it("caps the batch size", () => {
    const tooMany = Array.from({ length: MAX_INVESTOR_CODE_CHANGES + 1 }, () => ({
      userId: ANNA,
      investorCode: "07KM42",
    }));
    expect(issuePaths(adminInvestorCodesSchema.safeParse(tooMany))).toContain("");
  });
});

describe("createInvestorSchema", () => {
  const valid = {
    fullName: "Anna Schmidt",
    email: "a@b.de",
    investorCode: "",
    password: "secret-password",
    passwordConfirmation: "secret-password",
  };

  it("leaves the investor ID out when it is empty", () => {
    const result = createInvestorSchema.safeParse({ ...valid, investorCode: "  " });
    expect(result.success && result.data.investorCode).toBeUndefined();
  });
  it("accepts a chosen investor ID, upper-cased", () => {
    const result = createInvestorSchema.safeParse({ ...valid, investorCode: "07km42" });
    expect(result.success && result.data.investorCode).toBe("07KM42");
  });
  it("rejects a malformed investor ID", () =>
    expect(failedField(createInvestorSchema.safeParse({ ...valid, investorCode: "12345" }))).toBe("investorCode"));
  it("rejects mismatched passwords", () =>
    expect(failedField(createInvestorSchema.safeParse({ ...valid, passwordConfirmation: "other-password" }))).toBe(
      "passwordConfirmation",
    ));
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

describe("adminInvestorStatusSchema", () => {
  it("accepts both statuses and drops an empty note", () => {
    for (const status of ["active", "deactivated"]) {
      const result = adminInvestorStatusSchema.safeParse({ userId: IDEMPOTENCY_KEY, status, note: "  " });
      expect(result.success && result.data).toEqual({ userId: IDEMPOTENCY_KEY, status, note: undefined });
    }
  });

  it("rejects an unknown status", () =>
    expect(
      failedField(adminInvestorStatusSchema.safeParse({ userId: IDEMPOTENCY_KEY, status: "deleted", note: "" })),
    ).toBe("status"));

  it("limits the note to 500 characters", () =>
    expect(
      failedField(
        adminInvestorStatusSchema.safeParse({ userId: IDEMPOTENCY_KEY, status: "deactivated", note: "x".repeat(501) }),
      ),
    ).toBe("note"));
});

describe("newsEntrySchema", () => {
  const valid = { publishedOn: "2026-11-24", textDe: " Neue Bankverbindung. ", visible: true };

  it("trims the German text; there is no English field (DeepL translates)", () => {
    const result = newsEntrySchema.safeParse({ ...valid, textEn: "ignored" });
    expect(result.success && result.data).toEqual({
      publishedOn: "2026-11-24",
      textDe: "Neue Bankverbindung.",
      visible: true,
    });
  });
  it("requires a real date and a German text", () => {
    for (const publishedOn of ["", "24.11.2026", "2026-02-30"]) {
      expect(failedField(newsEntrySchema.safeParse({ ...valid, publishedOn }))).toBe("publishedOn");
    }
    expect(failedField(newsEntrySchema.safeParse({ ...valid, textDe: "   " }))).toBe("textDe");
  });
  it("limits the text to 500 characters", () => {
    expect(newsEntrySchema.safeParse({ ...valid, textDe: "a".repeat(500) }).success).toBe(true);
    expect(failedField(newsEntrySchema.safeParse({ ...valid, textDe: "a".repeat(501) }))).toBe("textDe");
  });
  it("accepts only a uuid as notice id", () => {
    expect(newsIdSchema.safeParse(IDEMPOTENCY_KEY).success).toBe(true);
    expect(newsIdSchema.safeParse("abc").success).toBe(false);
  });
});
