import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./errors";

const pgError = (constraint: string) => ({ code: "23505", constraint });

describe("isUniqueViolation", () => {
  it("matches any unique violation without a name", () => {
    expect(isUniqueViolation(pgError("users_email_unique"))).toBe(true);
  });

  it("matches the named constraint through `cause`", () => {
    expect(isUniqueViolation({ cause: pgError("users_investor_code_unique") }, "users_investor_code_unique")).toBe(
      true,
    );
  });

  it("does not match a different constraint", () => {
    expect(isUniqueViolation(pgError("users_email_unique"), "users_investor_code_unique")).toBe(false);
  });

  it("ignores other error codes", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });
});
