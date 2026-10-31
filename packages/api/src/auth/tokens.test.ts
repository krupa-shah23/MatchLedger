/**
 * AU3, AU4: JWT token handling tests
 */

import { describe, it, expect } from "vitest";
import { signToken, verifyToken, type TokenConfig } from "./tokens.js";

describe("AU: JWT Tokens", () => {
  const config: TokenConfig = {
    secret: new TextEncoder().encode("a".repeat(32)),
    ttlSeconds: 900,
  };

  it("AU3: Valid token is verified and decoded", async () => {
    const token = await signToken(config, "user-123", "TRADER");

    const claims = await verifyToken(config, token);
    expect(claims.sub).toBe("user-123");
    expect(claims.role).toBe("TRADER");
    expect(claims.auth_time).toBeDefined();
    expect(claims.iat).toBeDefined();
    expect(claims.exp).toBeDefined();
    expect(claims.jti).toBeDefined();
  });

  it("AU3: Token with wrong signature is rejected", async () => {
    const token = await signToken(config, "user-123", "TRADER");

    const wrongConfig: TokenConfig = {
      secret: new TextEncoder().encode("b".repeat(32)),
      ttlSeconds: 900,
    };

    await expect(verifyToken(wrongConfig, token)).rejects.toThrow();
  });

  it("AU3: Expired token is rejected", async () => {
    const token = await signToken({ ...config, ttlSeconds: -60 }, "user-123", "TRADER");
    await expect(verifyToken(config, token)).rejects.toThrow(/exp.*claim timestamp check failed/i);
  });

  it("AU3: Missing or malformed token is rejected", async () => {
    const invalidTokens = [
      "", // Empty
      "not.a.token", // Wrong format
      "invalid", // No structure
    ];

    for (const invalidToken of invalidTokens) {
      await expect(verifyToken(config, invalidToken)).rejects.toThrow();
    }
  });

  it("AU4: Token claims include auth_time", async () => {
    const authTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const token = await signToken(config, "user-123", "TRADER", authTime);

    const claims = await verifyToken(config, token);
    expect(claims.auth_time).toBe(authTime);
  });
});
