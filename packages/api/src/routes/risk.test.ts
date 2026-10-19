/**
 * RA: Risk routes tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, MockRuntimeFacade, createTestToken } from "../test-helpers.js";

describe("RA: Risk", () => {
  let app: FastifyInstance;
  let facade: MockRuntimeFacade;
  let token: string;

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    facade = result.facade;
    token = await createTestToken("user123", "RISK", ["acc1"]);
  });

  afterEach(async () => {
    facade.reset();
    await app.close();
  });

  it("RA1: Halt symbol 202", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/risk/symbols/ACME/halt",
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: "Circuit breaker" },
    });

    expect(res.statusCode).toBe(202);
    expect(facade.calls.some((c) => c.method === "haltSymbol")).toBe(true);
  });

  it("RA2: Resume symbol 202", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/risk/symbols/ACME/resume",
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: "Manual override" },
    });

    expect(res.statusCode).toBe(202);
    expect(facade.calls.some((c) => c.method === "resumeSymbol")).toBe(true);
  });

  it("RA3: Halted symbol then orders rejected asynchronously", async () => {
    // Halt the symbol
    await app.inject({
      method: "POST",
      url: "/risk/symbols/ACME/halt",
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: "Test halt" },
    });

    // Try to submit order (should still be 202)
    const traderToken = await createTestToken("trader", "TRADER", ["acc1"]);
    const orderRes = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${traderToken}` },
      payload: {
        clientOrderId: "test-halt",
        symbol: "ACME",
        side: "BUY",
        type: "LIMIT",
        timeInForce: "GTC",
        quantity: 10,
        price: "100.00",
      },
    });

    // Still returns 202 (rejection happens asynchronously in engine)
    expect(orderRes.statusCode).toBe(202);
  });

  it("RA4: Rejections feed", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/risk/rejections",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const rejections = JSON.parse(res.payload);
    expect(Array.isArray(rejections)).toBe(true);
  });

  it("RA5: Breakers status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/risk/breakers",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const breakers = JSON.parse(res.payload);
    expect(Array.isArray(breakers)).toBe(true);
  });
});
