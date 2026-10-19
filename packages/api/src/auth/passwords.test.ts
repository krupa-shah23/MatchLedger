/**
 * AU6: Scrypt password hashing tests
 */

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, getDummyHash } from "./passwords.js";

describe("AU: Authentication - Passwords", () => {
  it("AU6: Scrypt hashes are unique and verifiable", async () => {
    const password = "test-password-123";

    // Hash the same password twice
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Hashes should be different (due to random salt)
    expect(hash1).not.toBe(hash2);

    // Both should verify correctly
    const verify1 = await verifyPassword(password, hash1);
    const verify2 = await verifyPassword(password, hash2);
    expect(verify1).toBe(true);
    expect(verify2).toBe(true);

    // Wrong password should fail
    const verifyWrong = await verifyPassword("wrong-password", hash1);
    expect(verifyWrong).toBe(false);
  });

  it("AU6: Hash format includes parameters", async () => {
    const password = "test-password";
    const hash = await hashPassword(password);

    // Format: scrypt$N$r$p$saltB64$hashB64
    const parts = hash.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toBe("16384"); // N (2^14)
    expect(parts[2]).toBe("8"); // r
    expect(parts[3]).toBe("1"); // p

    // Salt and hash should be base64
    expect(() => Buffer.from(parts[4]!, "base64")).not.toThrow();
    expect(() => Buffer.from(parts[5]!, "base64")).not.toThrow();
  });

  it("AU6: Dummy hash fails verification (timing-safe unknown user)", async () => {
    const dummyHash = getDummyHash();
    const result = await verifyPassword("any-password", dummyHash);
    expect(result).toBe(false);
  });

  it("AU6: Invalid hash format returns false", async () => {
    const invalidHashes = [
      "not-a-hash",
      "scrypt$wrong-format",
      "scrypt$N$r$p$salt$hash$extra",
      "md5$hash",
    ];

    for (const hash of invalidHashes) {
      expect(await verifyPassword("password", hash)).toBe(false);
    }
  });
});
