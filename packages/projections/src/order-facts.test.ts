import { describe, it, expect } from "vitest";
import { deriveOrderStatus } from "./order-facts.js";
import type { OrderFacts } from "./order-facts.js";

describe("OS: Order status derivation", () => {
  it("OS1: deriveOrderStatus truth table precedence", () => {
    // Test each precedence level
    // REJECTED > filled===qty > CANCELLED > cancelRequested > filled > rested > accepted > RECEIVED
    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: true,
        rested: true,
        filledQty: 50n,
        terminal: "REJECTED",
        cancelRequested: true,
        hasCommand: true,
      })
    ).toBe("REJECTED");

    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: true,
        rested: true,
        filledQty: 100n,
        terminal: null,
        cancelRequested: true,
        hasCommand: true,
      })
    ).toBe("FILLED");

    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: true,
        rested: true,
        filledQty: 50n,
        terminal: "CANCELLED",
        cancelRequested: false,
        hasCommand: true,
      })
    ).toBe("CANCELLED");

    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: true,
        rested: true,
        filledQty: 50n,
        terminal: null,
        cancelRequested: true,
        hasCommand: true,
      })
    ).toBe("CANCEL_REQUESTED");

    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: true,
        rested: true,
        filledQty: 50n,
        terminal: null,
        cancelRequested: false,
        hasCommand: true,
      })
    ).toBe("PARTIALLY_FILLED");

    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: true,
        rested: true,
        filledQty: 0n,
        terminal: null,
        cancelRequested: false,
        hasCommand: true,
      })
    ).toBe("RESTING");

    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: true,
        rested: false,
        filledQty: 0n,
        terminal: null,
        cancelRequested: false,
        hasCommand: true,
      })
    ).toBe("ACCEPTED");

    expect(
      deriveOrderStatus({
        quantity: 100n,
        accepted: false,
        rested: false,
        filledQty: 0n,
        terminal: null,
        cancelRequested: false,
        hasCommand: true,
      })
    ).toBe("RECEIVED");
  });

  it("OS2: Property - any permutation of fact-learning gives same status", () => {
    // Same facts, queried in different order, should give same result
    const facts: OrderFacts = {
      quantity: 100n,
      accepted: true,
      rested: true,
      filledQty: 100n,
      terminal: null,
      cancelRequested: false,
      hasCommand: true,
    };

    const status1 = deriveOrderStatus(facts);
    const status2 = deriveOrderStatus({ ...facts }); // Different reference, same values
    expect(status1).toBe(status2);
    expect(status1).toBe("FILLED");
  });

  it("OS3: Impossible facts throw", () => {
    const facts: OrderFacts = {
      quantity: 100n,
      accepted: true,
      rested: true,
      filledQty: 101n, // More than quantity!
      terminal: null,
      cancelRequested: false,
      hasCommand: true,
    };

    expect(() => deriveOrderStatus(facts)).toThrow(/Impossible/);
  });
});
