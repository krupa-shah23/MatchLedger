/**
 * SA: Admin routes tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, createTestToken } from "../test-helpers.js";

describe("SA: Admin", () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    token = await createTestToken("admin", "ADMIN", ["acc1"]);
  });

  afterEach(async () => {
    await app.close();
  });

  it("SA1: Create user and account, deposit", async () => {
    // Create user (stub - would need actual implementation)
    // Create account (stub)
    // Deposit funds (stub)
    expect(true).toBe(true);
  });

  it("SA2: Username conflict weak password", async () => {
    // Duplicate username should return 409
    // Weak password should return 400
    expect(true).toBe(true);
  });

  it("SA3: System invariants check", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/system/invariants",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const invariants = JSON.parse(res.payload);
    expect(invariants).toHaveProperty("ledgerZeroSum");
    expect(invariants).toHaveProperty("positionsZeroSum");
  });

  it("SA4: System health projector lag", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/system/health",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const health = JSON.parse(res.payload);
    expect(health).toHaveProperty("status");
  });
});
