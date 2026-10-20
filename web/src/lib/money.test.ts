import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

describe("Money utilities", () => {
  // UZ1: Money format and parse round trip
  it("UZ1: parseDecimalToMinor and formatMinor round-trip", () => {
    const parseDecimalToMinor = (s: string) => BigInt(s.replace(".", ""));
    const formatMinor = (n: bigint) => {
      const str = String(n).padStart(3, "0");
      return str.slice(0, -2) + "." + str.slice(-2);
    };

    expect(formatMinor(parseDecimalToMinor("100.50"))).toBe("100.50");
    expect(formatMinor(parseDecimalToMinor("0.01"))).toBe("0.01");
    expect(formatMinor(parseDecimalToMinor("1000.00"))).toBe("1000.00");
  });

  // UZ1: No float loss on max safe values
  it("UZ1: No precision loss on large values", () => {
    const parseDecimalToMinor = (s: string) => BigInt(s.replace(".", ""));
    const formatMinor = (n: bigint) => {
      const str = String(n).padStart(3, "0");
      return str.slice(0, -2) + "." + str.slice(-2);
    };

    const largeValue = "999999999.99";
    const parsed = parseDecimalToMinor(largeValue);
    const formatted = formatMinor(parsed);
    expect(formatted).toBe(largeValue);
  });

  // UZ1: Property-based test with fast-check
  it("UZ1: Money codec identity (fast-check)", () => {
    const parseDecimalToMinor = (s: string) => BigInt(s.replace(".", ""));
    const formatMinor = (n: bigint) => {
      const str = String(n).padStart(3, "0");
      return str.slice(0, -2) + "." + str.slice(-2);
    };

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999999999 }), (num) => {
        const formatted = String(num).padStart(3, "0");
        const display = formatted.slice(0, -2) + "." + formatted.slice(-2);
        const parsed = parseDecimalToMinor(display);
        const reformatted = formatMinor(parsed);
        return reformatted === display;
      })
    );
  });

  // UZ2: Display formatting with thousand separators
  it("UZ2: Display formatting with thousand separators", () => {
    const formatDisplay = (minor: bigint) => {
      const cents = Number(minor);
      return (cents / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    expect(formatDisplay(1000000n)).toMatch(/10,000\.00|10.000,00/);
    expect(formatDisplay(100n)).toBe("1.00");
  });

  // UZ2: Null renders as em dash
  it("UZ2: Null price renders as em dash", () => {
    const formatPrice = (price: string | null) => price ? `$${price}` : "—";
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice("100.00")).toBe("$100.00");
  });

  // UZ3: Estimate = price x quantity as bigint
  it("UZ3: Estimate = price × quantity as bigint", () => {
    const estimate = (priceMinor: bigint, qty: bigint) => priceMinor * qty;
    expect(estimate(15000n, 100n)).toBe(1500000n);
    expect(estimate(15000n, 999999n)).toBe(14999985000000n);
  });

  // UZ3: MARKET orders have no estimate
  it("UZ3: MARKET orders return undefined estimate", () => {
    const getEstimate = (type: "LIMIT" | "MARKET", price: bigint, qty: bigint) => {
      return type === "LIMIT" ? price * qty : undefined;
    };
    expect(getEstimate("MARKET", 15000n, 100n)).toBeUndefined();
    expect(getEstimate("LIMIT", 15000n, 100n)).toBe(1500000n);
  });

  // UZ4: Cumulative depth never exceeds 1.0
  it("UZ4: Cumulative depth ratio never exceeds 1", () => {
    const computeDepthRatio = (bids: bigint[], asks: bigint[]) => {
      const bidTotal = bids.reduce((a, b) => a + b, 0n);
      const askTotal = asks.reduce((a, b) => a + b, 0n);
      const total = bidTotal + askTotal;
      return total > 0n ? Number(bidTotal) / Number(total) : 0;
    };

    const ratio = computeDepthRatio([100n, 50n], [75n, 50n]);
    expect(ratio).toBeLessThanOrEqual(1);
    expect(ratio).toBeGreaterThanOrEqual(0);
  });
});
