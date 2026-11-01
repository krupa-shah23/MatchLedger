import { describe, it, expect } from "vitest";
import { isDemoProfile, readWebConfig } from "./config.js";
import { deriveLifecycle, type Order } from "./lib/lifecycle.js";

describe("validated pending hint configuration", () => {
  it("defaults, accepts overrides, rejects invalid settings", () => {
    expect(readWebConfig({}).pendingHintMs).toBe(10000);
    expect(readWebConfig({ VITE_PENDING_HINT_MS: "750" }).pendingHintMs).toBe(750);
    for (const value of ["", " ", "-1", "0", "1.5", "NaN", "Infinity", "oops"]) {
      expect(() => readWebConfig({ VITE_PENDING_HINT_MS: value })).toThrow();
    }
    expect(readWebConfig({}).pollIntervalMs).toBe(5000);
    expect(readWebConfig({ VITE_POLL_INTERVAL_MS: "8000" }).pollIntervalMs).toBe(8000);
    for (const value of ["", "0", "-1", "2.5", "NaN", "Infinity"]) {
      expect(() => readWebConfig({ VITE_POLL_INTERVAL_MS: value })).toThrow();
    }
  });
  it("applies the configured threshold to the actual lifecycle", () => {
    const order: Order = { id: "o", symbol: "ACME", side: "BUY", quantity: "1",
      filledQty: "0", status: "ACCEPTED", createdAt: "1970-01-01T00:00:00.000Z" };
    expect(deriveLifecycle(order, 751, 750).text).toBe("pending");
    expect(deriveLifecycle(order, 750, 750).text).toBe("accepted");
  });
});

it("enables demo controls for a profile with whitespace but not for other profiles", () => {
  expect(isDemoProfile("\tdemo")).toBe(true);
  expect(isDemoProfile(" demo \n")).toBe(true);
  expect(isDemoProfile("prod")).toBe(false);
  expect(isDemoProfile(undefined)).toBe(false);
});
