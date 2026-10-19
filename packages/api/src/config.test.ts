/**
 * CF1: Config parsing tests
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 bytes"),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  SESSION_MAX_SECONDS: z.coerce.number().int().positive().default(28800),
  PROFILE: z.enum(["demo", "prod"]).default("prod"),
  PRICE_DECIMALS: z.coerce.number().int().min(0).max(8).default(2),
  RATE_LIMIT_ORDERS_PER_SEC: z.coerce.number().positive().default(10),
  RATE_LIMIT_BURST: z.coerce.number().positive().default(20),
  PROJECTOR_POLL_MS: z.coerce.number().int().positive().default(200),
  PROJECTOR_CHUNK: z.coerce.number().int().positive().default(1000),
});

describe("CF: Config", () => {
  it("CF1: Config parsing with missing or invalid env gives readable error", () => {
    const env = {
      DATABASE_URL: "not-a-url", // Invalid URL
      // Missing JWT_SECRET
    };

    const result = configSchema.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.length).toBeGreaterThan(0);
      // Should have errors for missing/invalid fields
      const issuePaths = issues.map((e) => e.path.join("."));
      expect(issuePaths.some((p) => p.includes("DATABASE_URL") || p.includes("JWT_SECRET"))).toBe(true);
    }
  });

  it("CF1: JWT_SECRET under 32 bytes is rejected", () => {
    const env = {
      DATABASE_URL: "postgres://localhost/test",
      JWT_SECRET: "short", // Less than 32 bytes
    };

    const result = configSchema.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      const jwtError = result.error.issues.find((e) => e.path[0] === "JWT_SECRET");
      expect(jwtError).toBeDefined();
      expect(jwtError?.message).toContain("32 bytes");
    }
  });

  it("CF1: Valid config parses successfully", () => {
    const env = {
      DATABASE_URL: "postgres://localhost/test",
      JWT_SECRET: "a".repeat(32), // Exactly 32 bytes
      SESSION_MAX_SECONDS: "7200",
      PROFILE: "demo",
    };

    const result = configSchema.safeParse(env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toBe("postgres://localhost/test");
      expect(result.data.JWT_SECRET).toBe("a".repeat(32));
      expect(result.data.SESSION_MAX_SECONDS).toBe(7200);
      expect(result.data.PROFILE).toBe("demo");
    }
  });
});
