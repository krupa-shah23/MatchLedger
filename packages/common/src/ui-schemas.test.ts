/**
 * UI schema validation tests (ZS6-ZS8)
 */

import { describe, it, expect } from "vitest";
import {
  loginRequestSchema,
  loginResponseSchema,
  orderRequestSchema,
  orderSchema,
  orderAcceptedResponseSchema,
  validationErrorSchema,
} from "./ui-schemas.js";
import { encodeMoney } from "./money.js";

describe("UI Schemas (ZS6-ZS8)", () => {
  it("ZS6: loginRequestSchema validates auth payload", () => {
    const valid = { username: "trader1", password: "secret123" };
    expect(loginRequestSchema.parse(valid)).toEqual(valid);

    expect(() => loginRequestSchema.parse({ username: "", password: "secret" })).toThrow();
    expect(() => loginRequestSchema.parse({ username: "trader1" })).toThrow();
  });

  it("ZS7: loginResponseSchema includes user role and token", () => {
    const valid = {
      token: "eyJhbGc...",
      user: { id: "user-1", username: "trader1", role: "TRADER" as const },
    };
    const parsed = loginResponseSchema.parse(valid);
    expect(parsed.user.role).toBe("TRADER");
    expect(parsed.token).toBeDefined();
  });

  it("ZS8: orderRequestSchema with money and quantity types", () => {
    const price = encodeMoney(1500000n); // $15.00
    const valid = {
      symbol: "AAPL",
      side: "BUY" as const,
      quantity: "100",
      priceCapOrFloor: price,
    };
    const parsed = orderRequestSchema.parse(valid);
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.quantity).toBe("100");
    expect(parsed.priceCapOrFloor).toBe(price);
  });

  it("ZS6b: orderSchema round-trip with all fields", () => {
    const now = new Date().toISOString();
    const order = {
      id: "ord-1",
      accountId: "acc-1",
      clientOrderId: "client-1",
      symbol: "AAPL",
      side: "BUY" as const,
      quantity: "100",
      quantityFilled: "50",
      priceCapOrFloor: encodeMoney(1500000n),
      effectivePrice: encodeMoney(1500000n),
      status: "PARTIALLY_FILLED" as const,
      reservationId: "res-1",
      createdAt: now,
      updatedAt: now,
    };
    const parsed = orderSchema.parse(order);
    expect(parsed.status).toBe("PARTIALLY_FILLED");
    expect(parsed.quantityFilled).toBe("50");
  });

  it("ZS7b: errorSchema for validation failures", () => {
    const error = {
      error: "Validation error",
      details: { symbol: ["required"], quantity: ["must be a positive number"] },
    };
    const parsed = validationErrorSchema.parse(error);
    const symbolErrors = parsed.details["symbol"];
    if (Array.isArray(symbolErrors)) {
      expect(symbolErrors[0]).toBe("required");
    }
  });

  it("ZS8b: orderAcceptedResponseSchema only has orderId and RECEIVED status", () => {
    const valid = { orderId: "ord-1", status: "RECEIVED" as const };
    const parsed = orderAcceptedResponseSchema.parse(valid);
    expect(parsed.status).toBe("RECEIVED");
  });
});
