import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { OrderBook } from "./orderBook.js";
import { OrderNode, PriceLevel } from "./priceLevel.js";

const PROPERTY_TIMEOUT_MS = 60_000;
const PROPERTY_RUNS = 2_000;

const order = (id: string, price: bigint, remaining: bigint, arrivalSeq: bigint, side: "BUY" | "SELL" = "BUY") => ({
  orderId: id,
  accountId: `account-${id}`,
  side,
  price,
  remaining,
  arrivalSeq,
});

const expectStrictlyOrdered = (prices: readonly bigint[], side: "BUY" | "SELL") => {
  for (let index = 1; index < prices.length; index += 1) {
    const previous = prices[index - 1];
    const current = prices[index];
    if (previous === undefined || current === undefined) {
      throw new Error("Expected a complete price pair");
    }
    if (side === "BUY") {
      expect(previous < current).toBe(true);
    } else {
      expect(previous > current).toBe(true);
    }
  }
};

describe("OrderBook", () => {
  it("cancels an order and removes an empty level", () => {
    const book = new OrderBook();
    book.addResting(order("one", 100n, 4n, 1n));
    expect(book.cancel("one")?.orderId).toBe("one");
    expect(book.has("one")).toBe(false);
    expect(book.view().bidPrices).toEqual([]);
    expect(book.cancel("unknown")).toBeUndefined();
  });

  it("keeps the other orders in arrival order when the middle order is cancelled", () => {
    const book = new OrderBook();
    book.addResting(order("one", 100n, 1n, 1n));
    book.addResting(order("two", 100n, 1n, 2n));
    book.addResting(order("three", 100n, 1n, 3n));
    book.cancel("two");
    const level = book.view().bids[0];
    expect(level?.orders.map((item) => item.orderId)).toEqual(["one", "three"]);
  });

  it("maintains prices and quantity totals through random adds and cancels", () => {
    const details = fc.check(
      fc.property(
        fc.array(fc.record({ add: fc.boolean(), price: fc.integer({ min: 1, max: 8 }) }), { maxLength: 100 }),
        (steps) => {
          const book = new OrderBook();
          const ids: string[] = [];
          steps.forEach((step, index) => {
            const id = `order-${index}`;
            if (step.add) {
              book.addResting(order(id, BigInt(step.price), 1n, BigInt(index)));
              ids.push(id);
            } else if (ids.length > 0) {
              book.cancel(ids.shift() ?? "");
            }
            const bestBid = book.bestBid();
            expect(bestBid === undefined || bestBid > 0n).toBe(true);
          });
          const view = book.view();
          expectStrictlyOrdered(view.bidPrices, "BUY");
          expectStrictlyOrdered(view.askPrices, "SELL");
          const prices = new Set(view.bids.map((level) => level.price));
          expect(view.bidPrices.length).toBe(prices.size);
          expect(view.bids.every((level) => level.totalQuantity > 0n)).toBe(true);
          const total = view.bids.reduce((sum, level) => sum + level.totalQuantity, 0n);
          const remaining = view.bids.reduce(
            (sum, level) => sum + level.orders.reduce((levelSum, item) => levelSum + item.remaining, 0n),
            0n,
          );
          expect(total).toBe(remaining);
        },
      ),
      { numRuns: PROPERTY_RUNS },
    );
    if (details.failed || details.interrupted || details.numRuns < PROPERTY_RUNS) {
      throw new Error(
        `Property incomplete or failed: seed=${details.seed} path=${details.counterexamplePath ?? "none"} ` +
        `counterexample=${JSON.stringify(details.counterexample)}`,
      );
    }
  }, PROPERTY_TIMEOUT_MS);
});

describe("PriceLevel iteration", () => {
  it("keeps a stable traversal when the current node is unlinked during iteration", () => {
    const level = new PriceLevel(100n);
    const nodes = ["a", "b", "c"].map((id, index) => new OrderNode(id, "acc", "BUY", 100n, 1n, BigInt(index)));
    nodes.forEach((node) => level.append(node));
    const seen: string[] = [];
    for (const node of level) {
      seen.push(node.orderId);
      level.unlink(node);
    }
    expect(seen).toEqual(["a", "b", "c"]);
    expect(level.isEmpty()).toBe(true);
  });
});
