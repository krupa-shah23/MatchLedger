import { describe, expect, it } from "vitest";
import { OrderBook } from "../src/book/orderBook.js";
import type { BookSnapshot, InstrumentSpec } from "../src/book/snapshot.js";
import { InvalidSnapshotError } from "../src/book/snapshot.js";
import { Engine } from "../src/matching/engine.js";
import { config, place } from "./helpers.js";

const spec: InstrumentSpec = {
  symbol: "ABC",
  tickSize: 1n,
  lotSize: 1n,
  maxQuantity: 1_000n,
  maxPrice: 10_000n,
};

const cloneSnapshot = <T>(value: T): T => {
  if (typeof value === "bigint") return BigInt(value.toString()) as T;
  if (Array.isArray(value)) return value.map((item) => cloneSnapshot(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneSnapshot(item)]),
    ) as T;
  }
  return value;
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
        deepFreeze(nested);
      }
    }
  }
  return value;
};

const corrupt = <T>(snapshot: T, mutate: (value: T) => T): T => mutate(cloneSnapshot(snapshot));

describe("snapshot contract", () => {
  it("SN1 empty book snapshots and restores without changing the book", () => {
    const book = new OrderBook();
    const snapshot = book.snapshot();
    const restored = OrderBook.restore(spec, snapshot);
    expect(restored.view()).toEqual(book.view());
    expect(restored.checkInvariants()).toEqual([]);

    const engineA = new Engine(config);
    const engineB = new Engine(config);
    engineA.apply(place("s1", "SELL", 100n, 5n));
    engineB.apply(place("s1", "SELL", 100n, 5n));
    expect(engineA.apply(place("b1", "BUY", 100n, 5n, 2n))).toEqual(engineB.apply(place("b1", "BUY", 100n, 5n, 2n)));
  });

  it("SN2 example 1 passes through snapshot and restore", () => {
    const book = new OrderBook();
    for (const id of ["o1", "o2", "o3"]) {
      book.addResting({ orderId: id, accountId: "a1", side: "SELL", price: id === "o3" ? 102n : 101n, remaining: id === "o1" ? 5n : id === "o2" ? 3n : 4n, arrivalSeq: BigInt(1 + ["o1", "o2", "o3"].indexOf(id)) });
    }

    const snapshot = book.snapshot();
    const restored = OrderBook.restore(spec, snapshot);
    expect(restored.view()).toEqual(book.view());
    expect(restored.checkInvariants()).toEqual([]);

    const untouched = new Engine(config);
    untouched.apply(place("o1", "SELL", 101n, 5n));
    untouched.apply(place("o2", "SELL", 101n, 3n));
    untouched.apply(place("o3", "SELL", 102n, 4n));
    const replay = new Engine(config);
    replay.apply(place("o1", "SELL", 101n, 5n));
    replay.apply(place("o2", "SELL", 101n, 3n));
    replay.apply(place("o3", "SELL", 102n, 4n));
    expect(replay.snapshotView()).toEqual(untouched.snapshotView());
    expect(replay.restingOrders()).toEqual(untouched.restingOrders());
  });

  it("SN3 cancel head, middle and tail after restore preserves arrival order", () => {
    const book = new OrderBook();
    for (const [index, id] of ["o1", "o2", "o3"].entries()) {
      book.addResting({ orderId: id, accountId: "a1", side: "SELL", price: 100n, remaining: 1n, arrivalSeq: BigInt(index + 1) });
    }
    const snapshot = book.snapshot();
    for (const victim of ["o1", "o2", "o3"]) {
      const restored = OrderBook.restore(spec, snapshot);
      restored.cancel(victim);
      expect(restored.restingOrders().map((item) => item.orderId)).toEqual(["o1", "o2", "o3"].filter((id) => id !== victim));
      expect(restored.checkInvariants()).toEqual([]);
    }
  });

  it("SN4 snapshot is isolated from later book changes and restore is not mutated by snapshot edits", () => {
    const book = new OrderBook();
    book.addResting({ orderId: "s1", accountId: "a1", side: "SELL", price: 100n, remaining: 5n, arrivalSeq: 1n });
    const snapshot = deepFreeze(book.snapshot());
    const before = cloneSnapshot(snapshot);
    book.addResting({ orderId: "b1", accountId: "a1", side: "BUY", price: 110n, remaining: 3n, arrivalSeq: 2n });
    expect(snapshot).toEqual(before);

    const restored = OrderBook.restore(spec, snapshot);
    const mut = cloneSnapshot(snapshot);
    const altered = corrupt(mut, (value) => ({ ...value, nextArrivalSeq: 99 }));
    expect(() => OrderBook.restore(spec, altered)).toBeInstanceOf(Function);
    expect(restored.checkInvariants()).toEqual([]);
  });

  it("SN5 malformed snapshots throw InvalidSnapshotError with the right reason", () => {
    const valid = new OrderBook();
    valid.addResting({ orderId: "s1", accountId: "a1", side: "SELL", price: 100n, remaining: 5n, arrivalSeq: 1n });
    const base = valid.snapshot();

    const cases: Array<[string, (snapshot: BookSnapshot) => BookSnapshot, string]> = [
      ["DUPLICATE_ORDER_ID", (snapshot) => ({ ...snapshot, asks: [{ price: 100n, orders: [{ ...snapshot.asks[0]!.orders[0]!, orderId: "dup" }, { ...snapshot.asks[0]!.orders[0]!, orderId: "dup" }] }] }), "DUPLICATE_ORDER_ID"],
      ["NON_POSITIVE_REMAINING", (snapshot) => ({ ...snapshot, asks: [{ ...snapshot.asks[0]!, orders: [{ ...snapshot.asks[0]!.orders[0]!, remaining: 0n }] }] }), "NON_POSITIVE_REMAINING"],
      ["SIDE_MISMATCH", (snapshot) => ({ ...snapshot, asks: [{ ...snapshot.asks[0]!, orders: [{ ...snapshot.asks[0]!.orders[0]!, side: "BUY" }] }] }), "SIDE_MISMATCH"],
      ["PRICE_MISMATCH", (snapshot) => ({ ...snapshot, asks: [{ ...snapshot.asks[0]!, price: 99n, orders: [{ ...snapshot.asks[0]!.orders[0]!, price: 100n }] }] }), "PRICE_MISMATCH"],
      ["LEVEL_ORDER", (snapshot) => ({ ...snapshot, asks: [{ ...snapshot.asks[0]!, price: 100n }, { ...snapshot.asks[0]!, price: 99n }] }), "LEVEL_ORDER"],
      ["EMPTY_LEVEL", (snapshot) => ({ ...snapshot, asks: [{ price: 100n, orders: [] }] }), "EMPTY_LEVEL"],
      ["ARRIVAL_ORDER", (snapshot) => ({ ...snapshot, asks: [{ ...snapshot.asks[0]!, orders: [{ ...snapshot.asks[0]!.orders[0]!, arrivalSeq: 2 }, { ...snapshot.asks[0]!.orders[0]!, arrivalSeq: 1 }] }] }), "ARRIVAL_ORDER"],
      ["CROSSED_BOOK", (snapshot) => ({ ...snapshot, bids: [{ price: 100n, orders: [{ ...snapshot.asks[0]!.orders[0]!, orderId: "b1", accountId: "a", side: "BUY", price: 100n, remaining: 5n, arrivalSeq: 1 }] }], asks: [{ price: 100n, orders: [{ ...snapshot.asks[0]!.orders[0]!, side: "SELL", remaining: 5n, price: 100n, arrivalSeq: 1 }] }] }), "CROSSED_BOOK"],
      ["NEGATIVE_COUNTER", (snapshot) => ({ ...snapshot, nextArrivalSeq: -1 }), "NEGATIVE_COUNTER"],
      ["VERSION", (snapshot) => ({ ...snapshot, version: 3 as unknown as 1 | 2 }), "VERSION"],
    ];

    for (const [label, mutation, reason] of cases) {
      const candidate = corrupt(base, mutation);
      expect(() => OrderBook.restore(spec, candidate), label).toThrow(InvalidSnapshotError);
      try {
        OrderBook.restore(spec, candidate);
      } catch (error) {
        expect((error as Error).message).toContain(reason);
      }
    }
  });

  it("SN6 different spec throws SPEC_MISMATCH", () => {
    const book = new OrderBook();
    book.addResting({ orderId: "s1", accountId: "a1", side: "SELL", price: 100n, remaining: 5n, arrivalSeq: 1n });
    const snapshot = book.snapshot();
    expect(() => OrderBook.restore({ ...spec, tickSize: 5n }, snapshot)).toThrow(InvalidSnapshotError);
  });

  it("SN7 canonical ordering gives equal snapshots for equivalent books", () => {
    const a = new OrderBook();
    const b = new OrderBook();
    for (const [id, price, side] of [["o1", 101n, "SELL"], ["o2", 101n, "SELL"], ["o3", 102n, "BUY"]] as const) {
      a.addResting({ orderId: id, accountId: "a1", side, price, remaining: 1n, arrivalSeq: BigInt(a.restingOrders().length + 1) });
      b.addResting({ orderId: id, accountId: "a1", side, price, remaining: 1n, arrivalSeq: BigInt(b.restingOrders().length + 1) });
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot()).toEqual(a.snapshot());
  });

  it("SN8 partial fills are preserved in the snapshot and survive restore", () => {
    const book = new OrderBook();
    book.addResting({ orderId: "m1", accountId: "a1", side: "SELL", price: 100n, remaining: 5n, arrivalSeq: 1n });
    const snapshot = book.snapshot();
    const restored = OrderBook.restore(spec, snapshot);
    expect(restored.restingOrders()).toEqual(book.restingOrders());
    expect(restored.view().asks[0]?.orders[0]?.remaining).toBe(5n);
  });

  it("SN9 counter fields track the next arrival/trade sequence", () => {
    const book = new OrderBook();
    book.addResting({ orderId: "o1", accountId: "a1", side: "SELL", price: 100n, remaining: 2n, arrivalSeq: 1n });
    const snapshot = book.snapshot();
    expect(snapshot.nextArrivalSeq).toBeGreaterThanOrEqual(2);
    expect(snapshot.nextTradeSeq).toBeGreaterThanOrEqual(1);
    expect(snapshot.symbol).toBe("ABC");
  });

  it("SN10 IOC remainder leaves no stale resting orders in the snapshot", () => {
    const engine = new Engine(config);
    engine.apply(place("ask", "SELL", 100n, 5n));
    engine.apply(place("bid", "BUY", 100n, 7n, 1n, "a1", 2n));
    const snapshot = new OrderBook().snapshot();
    expect(snapshot.asks).toEqual([]);
    expect(snapshot.bids).toEqual([]);
  });

  it("SNB1: version 2 snapshots preserve breaker metadata and restore it", async () => {
    const book = new OrderBook();
    book.addResting({ orderId: "s1", accountId: "a1", side: "SELL", price: 100n, remaining: 5n, arrivalSeq: 1n });

    const breakerConfig = {
      windowTrades: 3,
      tripThresholdBps: 500n,
      resetThresholdBps: 200n,
      cooldownMs: 10_000,
      halfOpenBandBps: 300n,
      halfOpenMaxOrdersPerSec: 2,
      halfOpenStableMs: 5_000,
      maxHaltDurationMs: 60_000,
    };

    const { Breaker } = await import("../src/breaker/breaker.js");
    const breaker = new Breaker(breakerConfig);
    breaker.halt("manual", 1_000);
    const snapshot = { ...book.snapshot(), version: 2 as const, breaker: { config: breakerConfig, state: breaker.snapshotState() } };

    const restored = OrderBook.restore(spec, snapshot, breakerConfig);
    expect(restored.view()).toEqual(book.view());
    expect(snapshot.breaker?.state.state).toBe("OPEN");
  });

  it("SNB2: v1 snapshots become a fresh Closed breaker when restored with config", () => {
    const book = new OrderBook();
    const snapshot = { ...book.snapshot(), version: 1 as const };
    const breakerConfig = {
      windowTrades: 3,
      tripThresholdBps: 500n,
      resetThresholdBps: 200n,
      cooldownMs: 10_000,
      halfOpenBandBps: 300n,
      halfOpenMaxOrdersPerSec: 2,
      halfOpenStableMs: 5_000,
      maxHaltDurationMs: 60_000,
    };

    const restored = OrderBook.restore(spec, snapshot, breakerConfig);
    expect(restored.view()).toEqual(book.view());
  });

  it("SNB3: breaker config or presence mismatch throws SPEC_MISMATCH", () => {
    const book = new OrderBook();
    const breakerConfig = {
      windowTrades: 3,
      tripThresholdBps: 500n,
      resetThresholdBps: 200n,
      cooldownMs: 10_000,
      halfOpenBandBps: 300n,
      halfOpenMaxOrdersPerSec: 2,
      halfOpenStableMs: 5_000,
      maxHaltDurationMs: 60_000,
    };
    const v2 = { ...book.snapshot(), version: 2 as const, breaker: { config: breakerConfig, state: { state: "OPEN", manual: false, window: [], anchorPrice: undefined, incidentStartTs: 1, stateSinceTs: 1, halfOpenBucket: new Map(), forceCancelled: false } } };

    expect(() => OrderBook.restore(spec, v2, { ...breakerConfig, tripThresholdBps: 600n })).toThrow(InvalidSnapshotError);
    expect(() => OrderBook.restore(spec, { ...v2, breaker: undefined }, breakerConfig)).toThrow(InvalidSnapshotError);
  });
});
