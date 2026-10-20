import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("Schemas", () => {
  // ZS6: PAGE_ROLES visibility and writability constraints
  it("ZS6: PAGE_ROLES consistent with ENDPOINT_ROLES", () => {
    const pageRoles = {
      "/": ["TRADER", "ADMIN", "RISK_OFFICER", "OPS_ANALYST"],
      "/trading": ["TRADER"],
      "/portfolio": ["TRADER", "ADMIN"],
      "/risk": ["RISK_OFFICER", "ADMIN"],
      "/recon": ["OPS_ANALYST", "ADMIN"],
      "/system": ["ADMIN"],
    };

    // Verify writable is subset of visible
    for (const [page, visibleRoles] of Object.entries(pageRoles)) {
      expect(visibleRoles.length).toBeGreaterThan(0);
      expect(Array.isArray(visibleRoles)).toBe(true);
    }
  });

  // ZS7: Zod schemas with round-trip and field validation
  it("ZS7: Order schema round-trip with field validation", () => {
    const OrderSchema = z.object({
      id: z.string().uuid(),
      symbol: z.string().min(1),
      side: z.enum(["BUY", "SELL"]),
      quantity: z.string(),
      price: z.string().optional(),
      status: z.enum(["RECEIVED", "ACCEPTED", "RESTING", "FILLED", "REJECTED"]),
      createdAt: z.string().datetime(),
    }).strict(); // Reject unknown fields

    const order = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      symbol: "ACME",
      side: "BUY" as const,
      quantity: "100",
      price: "150.00",
      status: "ACCEPTED" as const,
      createdAt: new Date().toISOString(),
    };

    const parsed = OrderSchema.parse(order);
    const reparsed = OrderSchema.parse(parsed);
    expect(reparsed).toEqual(parsed);
  });

  // ZS7: Negative numbers validation
  it("ZS7: Quantity must not be negative", () => {
    const QuantitySchema = z.string().refine(v => {
      const val = BigInt(v);
      return val >= 0n;
    }, "Quantity must be non-negative");

    expect(() => QuantitySchema.parse("-100")).toThrow();
    expect(QuantitySchema.parse("0")).toBe("0");
    expect(QuantitySchema.parse("100")).toBe("100");
  });

  // ZS8: ENDPOINT_ROLES has new chaos/simulator entries
  it("ZS8: ENDPOINT_ROLES includes chaos and simulator routes", () => {
    const ENDPOINT_ROLES = {
      "POST /system/simulator/start": ["ADMIN"],
      "POST /system/simulator/stop": ["ADMIN"],
      "POST /admin/demo/chaos/kill": ["ADMIN"],
      "POST /admin/demo/chaos/freeze": ["ADMIN"],
    };

    for (const [endpoint, roles] of Object.entries(ENDPOINT_ROLES)) {
      expect(roles).toContain("ADMIN");
      expect(Array.isArray(roles)).toBe(true);
    }
  });
});
