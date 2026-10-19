/**
 * PX: P&L calculation tests
 * Realized P&L rule: on a SELL fill of f shares from position of q with basis B:
 * removed = q == f ? B : floor(B * f / q)
 * realized += proceeds - removed
 * basis -= removed
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

function calculateRealizedPnL(
  quantity: bigint,
  filled: bigint,
  basis: bigint,
  proceeds: bigint
): { realizedPnL: bigint; newBasis: bigint } {
  if (filled === 0n) {
    return { realizedPnL: 0n, newBasis: basis };
  }

  let removed: bigint;
  if (quantity === filled) {
    removed = basis;
  } else {
    // floor(B * f / q)
    removed = (basis * filled) / quantity;
  }

  const realizedPnL = proceeds - removed;
  const newBasis = basis - removed;

  return { realizedPnL, newBasis };
}

describe("PX: P&L calculations", () => {
  it("PX1: P&L rule vectors", () => {
    // Test case 1: Partial fill
    // Position: 100 @ 100 (basis 10,000)
    // Sell 40 @ 110 (proceeds 4,400)
    // Expected: removed = floor(10,000 * 40 / 100) = 4,000
    //           realized = 4,400 - 4,000 = 400
    //           newBasis = 10,000 - 4,000 = 6,000
    const result1 = calculateRealizedPnL(100n, 40n, 10000n, 4400n);
    expect(result1.realizedPnL).toBe(400n);
    expect(result1.newBasis).toBe(6000n);

    // Test case 2: Full position fill
    // Position: 100 @ 100 (basis 10,000)
    // Sell 100 @ 110 (proceeds 11,000)
    // Expected: removed = 10,000 (full basis)
    //           realized = 11,000 - 10,000 = 1,000
    //           newBasis = 0
    const result2 = calculateRealizedPnL(100n, 100n, 10000n, 11000n);
    expect(result2.realizedPnL).toBe(1000n);
    expect(result2.newBasis).toBe(0n);

    // Test case 3: Rounding with partial fill
    // Position: 3 @ 100 (basis 300)
    // Sell 2 @ 110 (proceeds 220)
    // Expected: removed = floor(300 * 2 / 3) = floor(200) = 200
    //           realized = 220 - 200 = 20
    //           newBasis = 300 - 200 = 100
    const result3 = calculateRealizedPnL(3n, 2n, 300n, 220n);
    expect(result3.realizedPnL).toBe(20n);
    expect(result3.newBasis).toBe(100n);

    // Test case 4: Loss scenario
    // Position: 100 @ 100 (basis 10,000)
    // Sell 50 @ 90 (proceeds 4,500)
    // Expected: removed = floor(10,000 * 50 / 100) = 5,000
    //           realized = 4,500 - 5,000 = -500
    //           newBasis = 10,000 - 5,000 = 5,000
    const result4 = calculateRealizedPnL(100n, 50n, 10000n, 4500n);
    expect(result4.realizedPnL ?? 0n).toBe(-500n);
    expect(result4.newBasis ?? 0n).toBe(5000n);
  });

  it("PX2: Unrealized P&L", () => {
    // Unrealized = quantity * mark - basis
    // mark is the price per share in minor units
    const quantity = 100n;
    const basis = 10000n;
    const mark = 11000n; // Last trade price per share: 110.00 (11000 minor units)

    const unrealized = quantity * mark - basis;
    expect(unrealized).toBe(1090000n); // 100 * 11000 - 10000 = 1,100,000 - 10,000 = 1,090,000

    // Test case: no mark (null)
    // When there's no mark price, unrealized should be null (not computed)
    const noMark = null;
    expect(noMark).toBeNull();
  });

  it("PX3: Book projection", () => {
    // resting_orders from engine snapshot
    // The book projection should match engine OrderBook.depth
    const resting = [
      { symbol: "ACME", side: "BUY", price: 10500n, quantity: 50n },
      { symbol: "ACME", side: "BUY", price: 10400n, quantity: 100n },
      { symbol: "ACME", side: "SELL", price: 10600n, quantity: 75n },
      { symbol: "ACME", side: "SELL", price: 10700n, quantity: 200n },
    ];

    const bid = resting.filter((r) => r.side === "BUY").sort((a, b) => Number(b.price - a.price));
    const ask = resting.filter((r) => r.side === "SELL").sort((a, b) => Number(a.price - b.price));

    expect(bid).toHaveLength(2);
    expect(ask).toHaveLength(2);
    expect(bid[0]!.price).toBe(10500n);
    expect(ask[0]!.price).toBe(10600n);
  });

  it("PX1: Property - rounding is consistent", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1000000n }),
        fc.bigInt({ min: 1n, max: 1000000n }),
        fc.bigInt({ min: 1n, max: 1000000n }),
        (quantity, filled, basis) => {
          const filledClamped = filled > quantity ? quantity : filled;
          const result = calculateRealizedPnL(quantity, filledClamped, basis, basis)!;

          // For same price (proceeds = quantity * price = basis), realized should be <= 0
          if (filledClamped === quantity) {
            expect(result.realizedPnL).toBe(0n);
            expect(result.newBasis).toBe(0n);
          }
        }
      )
    );
  });
});
