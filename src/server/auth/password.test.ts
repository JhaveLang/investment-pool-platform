import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const storedHash = await hashPassword("korrektes-Passwort-123");
    expect(storedHash.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("korrektes-Passwort-123", storedHash)).resolves.toBe(true);
    await expect(verifyPassword("falsches-Passwort-123", storedHash)).resolves.toBe(false);
  });

  it("produces a different salt for every hash", async () => {
    const [firstHash, secondHash] = await Promise.all([hashPassword("gleich"), hashPassword("gleich")]);
    expect(firstHash).not.toBe(secondHash);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("irrelevant", "not-a-hash")).resolves.toBe(false);
  });
});
