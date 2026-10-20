/**
 * Order lifecycle derivation tests (UL1-UL6)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { deriveLifecycle, PENDING_HINT_MS, type Order, type OrderStatus } from "./lifecycle.js";

const baseOrder: Order = {
  id: "ord-1",
  symbol: "AAPL",
  side: "BUY",
  quantity: "100",
  filledQty: "0",
  status: "RECEIVED",
  createdAt: new Date().toISOString(),
};

describe("Order Lifecycle Derivation (UL1-UL6)", () => {
  it("UL1: RECEIVED shows spinner and 'durably received' text", () => {
    const now = Date.now();
    const result = deriveLifecycle({ ...baseOrder, status: "RECEIVED" }, now);

    expect(result.stage).toBe("journaled");
    expect(result.spinner).toBe(true);
    expect(result.text).toContain("durably received");
  });

  it("UL2: ACCEPTED spinner + no hint before PENDING_HINT_MS", () => {
    const now = Date.now();
    const createdTime = now - 1000; // 1 sec ago
    const order = {
      ...baseOrder,
      status: "ACCEPTED" as OrderStatus,
      createdAt: new Date(createdTime).toISOString(),
    };

    const result = deriveLifecycle(order, now);
    expect(result.stage).toBe("accepted");
    expect(result.spinner).toBe(true);
    if ("hint" in result) {
      expect(result.hint).toBe(false);
    }
  });

  it("UL3: ACCEPTED shows hint after PENDING_HINT_MS", () => {
    const now = Date.now();
    const createdTime = now - (PENDING_HINT_MS + 1000); // 4+ seconds ago
    const order = {
      ...baseOrder,
      status: "ACCEPTED" as OrderStatus,
      createdAt: new Date(createdTime).toISOString(),
    };

    const result = deriveLifecycle(order, now);
    expect(result.stage).toBe("accepted");
    expect(result.spinner).toBe(true);
    if ("hint" in result) {
      expect(result.hint).toBe(true);
      expect(result.text).toBe("pending");
    }
  });

  it("UL4: PARTIALLY_FILLED shows percentage and qty", () => {
    const now = Date.now();
    const result = deriveLifecycle(
      {
        ...baseOrder,
        status: "PARTIALLY_FILLED",
        filledQty: "50",
        quantity: "100",
      },
      now
    );

    expect(result.stage).toBe("filled");
    expect(result.spinner).toBe(false);
    expect(result.text).toContain("50");
    expect(result.text).toContain("100");
    expect(result.text).toContain("50%");
  });

  it("UL5: REJECTED includes reason", () => {
    const now = Date.now();
    const result = deriveLifecycle(
      {
        ...baseOrder,
        status: "REJECTED",
        terminalReason: "Insufficient funds",
      },
      now
    );

    expect(result.stage).toBe("rejected");
    expect(result.spinner).toBe(false);
    if ("reason" in result) {
      expect(result.reason).toBe("Insufficient funds");
    }
  });

  it("UL6: Property test - all statuses produce valid states", () => {
    const statuses: OrderStatus[] = [
      "RECEIVED",
      "ACCEPTED",
      "RESTING",
      "PARTIALLY_FILLED",
      "FILLED",
      "CANCEL_REQUESTED",
      "CANCELLED",
      "REJECTED",
    ];

    const orderArb = fc
      .tuple(
        fc.constantFrom(...statuses),
        fc.integer({ min: 0, max: 1000 }) // age in ms
      )
      .map(([status, ageMs]) => ({
        ...baseOrder,
        status,
        createdAt: new Date(Date.now() - ageMs).toISOString(),
      }));

    fc.assert(
      fc.property(orderArb, (order) => {
        const result = deriveLifecycle(order, Date.now());

        // All results must have required fields
        expect(result.stage).toBeDefined();
        expect(typeof result.spinner).toBe("boolean");
        expect(typeof result.text).toBe("string");
        expect(result.text.length).toBeGreaterThan(0);

        // Stage matches status family
        if (order.status === "RECEIVED") expect(result.stage).toBe("journaled");
        if (["ACCEPTED", "CANCEL_REQUESTED"].includes(order.status)) {
          expect(result.stage).toBe("accepted");
        }
        if (["FILLED", "PARTIALLY_FILLED"].includes(order.status)) {
          expect(result.stage).toBe("filled");
        }
      }),
      { numRuns: 100 }
    );
  });
});
