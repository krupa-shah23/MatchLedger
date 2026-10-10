import { describe, expect, it } from "vitest";
import { SortedPrices } from "./sortedPrices.js";

describe("SortedPrices", () => {
  it("keeps bids ascending with the best price last", () => {
    const prices = new SortedPrices("BUY");
    prices.insert(100n);
    prices.insert(300n);
    prices.insert(200n);
    expect(prices.toArray()).toEqual([100n, 200n, 300n]);
    expect(prices.best()).toBe(300n);
  });

  it("keeps asks descending with the best price last", () => {
    const prices = new SortedPrices("SELL");
    prices.insert(100n);
    prices.insert(300n);
    prices.insert(200n);
    expect(prices.toArray()).toEqual([300n, 200n, 100n]);
    expect(prices.best()).toBe(100n);
  });
});
