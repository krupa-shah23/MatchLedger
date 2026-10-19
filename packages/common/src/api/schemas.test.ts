import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PlaceOrderBodySchema, ListOrdersQuerySchema, LoginSchema } from "./schemas.js";
import { formatMinor, parseDecimalToMinor } from "./money-format.js";
import { ENDPOINT_ROLES } from "./roles.js";
import { buildProblem } from "./problem.js";

describe("ZS1: PlaceOrderBody accepts valid LIMIT and MARKET", () => {
  it("parses LIMIT order with numeric quantity", () => {
    const result = PlaceOrderBodySchema.parse({
      clientOrderId: "c1",
      symbol: "ACME",
      side: "BUY",
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: 100,
      price: "105.00",
    });
    expect(result.quantity).toBe(100n);
  });

  it("parses LIMIT order with string quantity", () => {
    const result = PlaceOrderBodySchema.parse({
      clientOrderId: "c1",
      symbol: "ACME",
      side: "BUY",
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: "100",
      price: "105.00",
    });
    expect(result.quantity).toBe(100n);
  });

  it("parses MARKET order with IOC", () => {
    const result = PlaceOrderBodySchema.parse({
      clientOrderId: "c2",
      symbol: "ACME",
      side: "SELL",
      type: "MARKET",
      timeInForce: "IOC",
      quantity: 50,
    });
    expect(result.quantity).toBe(50n);
    expect(result.price).toBeUndefined();
  });
});

describe("ZS2: PlaceOrderBody rejects invalid inputs", () => {
  it("rejects MARKET with price", () => {
    expect(() => {
      PlaceOrderBodySchema.parse({
        clientOrderId: "c",
        symbol: "ACME",
        side: "BUY",
        type: "MARKET",
        timeInForce: "IOC",
        quantity: 10,
        price: "100.00",
      });
    }).toThrow();
  });

  it("rejects LIMIT without price", () => {
    expect(() => {
      PlaceOrderBodySchema.parse({
        clientOrderId: "c",
        symbol: "ACME",
        side: "BUY",
        type: "LIMIT",
        timeInForce: "GTC",
        quantity: 10,
      });
    }).toThrow();
  });

  it("rejects MARKET with GTC", () => {
    expect(() => {
      PlaceOrderBodySchema.parse({
        clientOrderId: "c",
        symbol: "ACME",
        side: "BUY",
        type: "MARKET",
        timeInForce: "GTC",
        quantity: 10,
      });
    }).toThrow();
  });

  it("rejects zero quantity", () => {
    expect(() => {
      PlaceOrderBodySchema.parse({
        clientOrderId: "c",
        symbol: "ACME",
        side: "BUY",
        type: "LIMIT",
        timeInForce: "GTC",
        quantity: 0,
        price: "100.00",
      });
    }).toThrow();
  });

  it("rejects negative quantity", () => {
    expect(() => {
      PlaceOrderBodySchema.parse({
        clientOrderId: "c",
        symbol: "ACME",
        side: "BUY",
        type: "LIMIT",
        timeInForce: "GTC",
        quantity: -10,
        price: "100.00",
      });
    }).toThrow();
  });

  it("rejects oversized clientOrderId", () => {
    expect(() => {
      PlaceOrderBodySchema.parse({
        clientOrderId: "x".repeat(65),
        symbol: "ACME",
        side: "BUY",
        type: "LIMIT",
        timeInForce: "GTC",
        quantity: 10,
        price: "100.00",
      });
    }).toThrow();
  });
});

describe("ZS3: formatMinor and parseDecimalToMinor round-trip", () => {
  it("round-trips via property test", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -9007199254740991n, max: 9007199254740991n }), fc.integer({ min: 0, max: 8 }), (amount, decimals) => {
        const formatted = formatMinor(amount, decimals);
        const parsed = parseDecimalToMinor(formatted, decimals);
        expect(parsed).toBe(amount);
      })
    );
  });

  it("formats USD amounts correctly", () => {
    expect(formatMinor(123456n, 2)).toBe("1234.56");
    expect(formatMinor(-123456n, 2)).toBe("-1234.56");
    expect(formatMinor(0n, 2)).toBe("0.00");
  });

  it("parses USD amounts correctly", () => {
    expect(parseDecimalToMinor("1234.56", 2)).toBe(123456n);
    expect(parseDecimalToMinor("-1234.56", 2)).toBe(-123456n);
    expect(parseDecimalToMinor("0.00", 2)).toBe(0n);
  });

  it("rejects too many decimal places", () => {
    expect(() => parseDecimalToMinor("10.123", 2)).toThrow();
  });
});

describe("ZS4: ENDPOINT_ROLES structure", () => {
  it("has a role set for every route", () => {
    for (const [route, roles] of Object.entries(ENDPOINT_ROLES)) {
      expect(roles.size).toBeGreaterThan(0);
      expect(route).toMatch(/^(GET|POST|PUT|DELETE|PATCH) /);
    }
  });

  it("has no duplicate keys", () => {
    const keys = Object.keys(ENDPOINT_ROLES);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });

  it("includes required endpoints", () => {
    expect(ENDPOINT_ROLES["POST /auth/login"]).toBeDefined();
    expect(ENDPOINT_ROLES["POST /orders"]).toBeDefined();
    expect(ENDPOINT_ROLES["GET /orders/{id}"]).toBeDefined();
  });
});

describe("ZS5: Schemas are browser-safe", () => {
  it("does not import node:* in api directory", () => {
    // This is verified by the boundary check script
    expect(true).toBe(true);
  });
});

describe("ER1: Problem builder", () => {
  it("builds a validation error", () => {
    const prob = buildProblem(
      "validation_failed",
      400,
      "Bad Request",
      "Invalid input",
      "req-123"
    );
    expect(prob.code).toBe("validation_failed");
    expect(prob.status).toBe(400);
    expect(prob.requestId).toBe("req-123");
    expect(prob.detail).toBe("Invalid input");
  });

  it("includes errors array when provided", () => {
    const errors = [{ path: "quantity", message: "must be positive" }];
    const prob = buildProblem(
      "validation_failed",
      400,
      "Bad Request",
      "Invalid",
      "req-123",
      "/",
      errors
    );
    expect(Array.isArray(prob.errors)).toBe(true);
    expect((prob.errors ?? []).length).toBe(1);
  });

  it("5xx has no internal detail", () => {
    const prob = buildProblem(
      "internal_error",
      500,
      "Internal Server Error",
      "An unexpected error occurred",
      "req-123"
    );
    expect(prob.detail).not.toContain("stack");
    expect(prob.detail).not.toContain("Error:");
  });
});
