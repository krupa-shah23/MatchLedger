/**
 * Money utilities tests (UZ1-UZ4)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatMoney, formatQuantity, formatTime, estimateReservation, cumulativeDepth, encodeMoney, decodeMoney } from "./money.js";

describe("Money Utilities (UZ1-UZ4)", () => {
  it("UZ1: formatMoney displays USD currency with proper formatting", () => {
    expect(formatMoney(1500000n)).toBe("$15.00");
    expect(formatMoney(100n)).toBe("$1.00");
    expect(formatMoney(1n)).toBe("$0.01");
    expect(formatMoney(0n)).toBe("$0.00");
    expect(formatMoney(-1500000n)).toBe("-$15.00");
  });

  it("UZ2: formatQuantity handles string and number inputs", () => {
    expect(formatQuantity("100")).toBe("100");
    expect(formatQuantity(100)).toBe("100");
    expect(formatQuantity(100.5)).toBe("100");
    expect(formatQuantity(null)).toBe("0");
    expect(formatQuantity("")).toBe("0");
  });

  it("UZ3: estimateReservation calculates qty * price (MARKET = 0)", () => {
    expect(estimateReservation("100", "1500000")).toBe(150000000000n);
    expect(estimateReservation(100, "1500000")).toBe(150000000000n);
    expect(estimateReservation("100", null)).toBe(0n); // MARKET order
    expect(estimateReservation("100", "null")).toBe(0n);
  });

  it("UZ4: cumulativeDepth sums quantities at or above price level", () => {
    const bids: Array<[string, string]> = [
      ["1500000", "100"],
      ["1490000", "150"],
      ["1480000", "200"],
    ];

    // Cumulative at or above 1490000: 100 + 150 = 250
    expect(cumulativeDepth(bids, "1490000")).toBe(250n);

    // Cumulative at or above 1480000: 100 + 150 + 200 = 450
    expect(cumulativeDepth(bids, "1480000")).toBe(450n);

    // Cumulative above all: 0
    expect(cumulativeDepth(bids, "1600000")).toBe(0n);
  });

  it("UZ1b: Fast-check round-trip for money codec", () => {
    const roundTrip = (minorUnits: bigint) => {
      const encoded = encodeMoney(minorUnits);
      const decoded = decodeMoney(encoded);
      return decoded === minorUnits;
    };

    // Test with a large range of values
    fc.assert(fc.property(fc.bigInt({ min: -9007199254740993n, max: 9007199254740993n }), roundTrip), {
      numRuns: 100,
    });
  });

  it("UZ2b: formatTime relative and absolute formats", () => {
    const now = new Date().toISOString();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();

    expect(formatTime(now, true)).toBe("just now");
    expect(formatTime(fiveMinutesAgo, true)).toContain("m ago");

    const absolute = formatTime(now, false);
    expect(absolute).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("UZ3b: estimateReservation with invalid input returns 0n", () => {
    expect(estimateReservation("invalid", "1500000")).toBe(0n);
    expect(estimateReservation("100", "invalid")).toBe(0n);
  });

  it("UZ4b: cumulativeDepth with invalid prices returns 0n", () => {
    const bids: Array<[string, string]> = [["1500000", "100"]];
    expect(cumulativeDepth(bids, "invalid")).toBe(0n);
  });
});
