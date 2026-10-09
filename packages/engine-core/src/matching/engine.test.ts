import { describe, expect, it } from "vitest";
import { Engine } from "./engine.js";
import type { InstrumentConfig, PlaceOrder, TimeInForce } from "./types.js";

const config: InstrumentConfig = {
  symbol: "ABC",
  tickSize: 1n,
  lotSize: 1n,
  maxQuantity: 1_000n,
  maxPrice: 10_000n,
};

const place = (orderId: string, side: "BUY" | "SELL", price: bigint, quantity: bigint, ts = 1n, accountId = "a", timeInForce: TimeInForce = "GTC"): PlaceOrder => ({
  kind: "PLACE",
  ts,
  orderId,
  accountId,
  side,
  orderType: "LIMIT",
  timeInForce,
  price,
  quantity,
});

describe("Engine", () => {
  it("matches a buy and sell at the same price", () => {
    const engine = new Engine(config);
    engine.apply(place("s1", "SELL", 100n, 5n));
    expect(engine.apply(place("b1", "BUY", 100n, 5n, 2n))).toEqual([
      { type: "ORDER_ACCEPTED", engineSeq: 3n, ts: 2n, orderId: "b1", accountId: "a", side: "BUY", orderType: "LIMIT", price: 100n, quantity: 5n },
      { type: "TRADE_EXECUTED", engineSeq: 4n, ts: 2n, tradeId: "ABC-T1", symbol: "ABC", price: 100n, quantity: 5n, takerOrderId: "b1", makerOrderId: "s1", takerAccountId: "a", makerAccountId: "a", takerSide: "BUY" },
    ]);
  });

  it("crosses the lower ask at the ask price", () => {
    const engine = new Engine(config);
    engine.apply(place("s1", "SELL", 90n, 2n));
    expect(engine.apply(place("b1", "BUY", 100n, 2n, 2n))).toHaveLength(2);
    expect(engine.apply(place("b2", "BUY", 100n, 1n, 3n))[1]).toMatchObject({ price: 100n });
  });

  it("sweeps three ask levels in price order", () => {
    const engine = new Engine(config);
    engine.apply(place("s3", "SELL", 103n, 1n));
    engine.apply(place("s1", "SELL", 101n, 1n));
    engine.apply(place("s2", "SELL", 102n, 1n));
    expect(engine.apply(place("b1", "BUY", 110n, 3n, 2n))).toEqual([
      expect.objectContaining({ type: "ORDER_ACCEPTED", engineSeq: 7n }),
      expect.objectContaining({ type: "TRADE_EXECUTED", engineSeq: 8n, makerOrderId: "s1", price: 101n }),
      expect.objectContaining({ type: "TRADE_EXECUTED", engineSeq: 9n, makerOrderId: "s2", price: 102n }),
      expect.objectContaining({ type: "TRADE_EXECUTED", engineSeq: 10n, makerOrderId: "s3", price: 103n }),
    ]);
  });

  it("fills same-price asks in arrival order and preserves a partially filled maker", () => {
    const engine = new Engine(config);
    engine.apply(place("s1", "SELL", 100n, 5n, 1n));
    engine.apply(place("s2", "SELL", 100n, 5n, 2n));
    engine.apply(place("b1", "BUY", 100n, 2n, 3n));
    expect(engine.apply(place("b2", "BUY", 100n, 4n, 4n))).toEqual([
      expect.objectContaining({ type: "ORDER_ACCEPTED", engineSeq: 7n }),
      expect.objectContaining({ type: "TRADE_EXECUTED", makerOrderId: "s1", quantity: 3n }),
      expect.objectContaining({ type: "TRADE_EXECUTED", makerOrderId: "s2", quantity: 1n }),
    ]);
  });

  it("rejects in the specified order and leaves the view unchanged", () => {
    const engine = new Engine({ ...config, tickSize: 10n, lotSize: 10n, maxQuantity: 100n, maxPrice: 1_000n });
    engine.apply(place("resting", "SELL", 100n, 10n));
    const before = engine.snapshotView();
    expect(engine.apply(place("bad", "BUY", 101n, 11n))).toEqual([
      { type: "ORDER_REJECTED", engineSeq: 3n, ts: 1n, orderId: "bad", reason: "INVALID_TICK" },
    ]);
    expect(engine.snapshotView()).toEqual(before);
    expect(engine.apply(place("bad", "BUY", 100n, 0n))[0]).toMatchObject({ reason: "INVALID_QUANTITY" });
    expect(engine.apply(place("bad", "BUY", 0n, 10n))[0]).toMatchObject({ reason: "INVALID_PRICE" });
    expect(engine.apply(place("bad", "BUY", 101n, 10n))[0]).toMatchObject({ reason: "INVALID_TICK" });
    expect(engine.apply(place("lot", "BUY", 100n, 11n))[0]).toMatchObject({ reason: "INVALID_LOT" });
    expect(engine.apply(place("bad", "BUY", 100n, 110n))[0]).toMatchObject({ reason: "EXCEEDS_MAX_QUANTITY" });
    expect(engine.apply(place("bad", "BUY", 2_000n, 10n))[0]).toMatchObject({ reason: "EXCEEDS_MAX_PRICE" });
  });

  it("rejects duplicate ids while resting and after filling", () => {
    const engine = new Engine(config);
    engine.apply(place("same", "SELL", 100n, 1n));
    expect(engine.apply(place("same", "BUY", 100n, 1n))[0]).toMatchObject({ reason: "DUPLICATE_ORDER_ID" });
    engine.apply(place("taker", "BUY", 100n, 1n));
    expect(engine.apply(place("taker", "SELL", 100n, 1n))[0]).toMatchObject({ reason: "DUPLICATE_ORDER_ID" });
  });

  it("rests a remainder at the tail and permits self-trade", () => {
    const engine = new Engine(config);
    engine.apply(place("ask", "SELL", 100n, 1n, 1n, "same"));
    const events = engine.apply(place("bid", "BUY", 110n, 2n, 2n, "same"));
    expect(events[1]).toMatchObject({ type: "TRADE_EXECUTED", price: 100n });
    expect(events[2]).toEqual({ type: "ORDER_RESTED", engineSeq: 5n, ts: 2n, orderId: "bid", side: "BUY", price: 110n, remaining: 1n });
  });

  it("handles ticks without changing the view and rejects invalid configuration", () => {
    const engine = new Engine(config);
    const before = engine.snapshotView();
    expect(engine.apply({ kind: "TICK", ts: 9n })).toEqual([]);
    expect(engine.snapshotView()).toEqual(before);
    expect(() => new Engine({ ...config, tickSize: 0n })).toThrow(RangeError);
    expect(() => new Engine({ ...config, lotSize: -1n })).toThrow(RangeError);
  });

  it("cancels unknown and already-filled orders with unchanged views", () => {
    const engine = new Engine(config);
    const before = engine.snapshotView();
    expect(engine.apply({ kind: "CANCEL", ts: 1n, orderId: "unknown" })).toEqual([
      { type: "CANCEL_REJECTED", engineSeq: 1n, ts: 1n, orderId: "unknown", reason: "ORDER_NOT_RESTING" },
    ]);
    expect(engine.snapshotView()).toEqual(before);
    engine.apply(place("ask", "SELL", 100n, 1n, 2n));
    engine.apply(place("bid", "BUY", 100n, 1n, 3n));
    const filledView = engine.snapshotView();
    expect(engine.apply({ kind: "CANCEL", ts: 4n, orderId: "ask" })).toEqual([
      { type: "CANCEL_REJECTED", engineSeq: 6n, ts: 4n, orderId: "ask", reason: "ORDER_NOT_RESTING" },
    ]);
    expect(engine.snapshotView()).toEqual(filledView);
  });

  it("cancels a resting order once and rejects a second cancel", () => {
    const engine = new Engine(config);
    engine.apply(place("resting", "BUY", 100n, 5n));
    expect(engine.apply({ kind: "CANCEL", ts: 2n, orderId: "resting" })).toEqual([
      { type: "ORDER_CANCELLED", engineSeq: 3n, ts: 2n, orderId: "resting", remaining: 5n, reason: "USER_REQUEST" },
    ]);
    const afterFirst = engine.snapshotView();
    expect(engine.apply({ kind: "CANCEL", ts: 3n, orderId: "resting" })).toEqual([
      { type: "CANCEL_REJECTED", engineSeq: 4n, ts: 3n, orderId: "resting", reason: "ORDER_NOT_RESTING" },
    ]);
    expect(engine.snapshotView()).toEqual(afterFirst);
  });

  it("cancels the middle order and preserves FIFO for a later taker", () => {
    const engine = new Engine(config);
    engine.apply(place("s1", "SELL", 100n, 1n));
    engine.apply(place("s2", "SELL", 100n, 1n));
    engine.apply(place("s3", "SELL", 100n, 1n));
    expect(engine.apply({ kind: "CANCEL", ts: 4n, orderId: "s2" })).toEqual([
      { type: "ORDER_CANCELLED", engineSeq: 7n, ts: 4n, orderId: "s2", remaining: 1n, reason: "USER_REQUEST" },
    ]);
    expect(engine.apply(place("b1", "BUY", 100n, 1n, 5n))).toEqual([
      { type: "ORDER_ACCEPTED", engineSeq: 8n, ts: 5n, orderId: "b1", accountId: "a", side: "BUY", orderType: "LIMIT", price: 100n, quantity: 1n },
      { type: "TRADE_EXECUTED", engineSeq: 9n, ts: 5n, tradeId: "ABC-T1", symbol: "ABC", price: 100n, quantity: 1n, takerOrderId: "b1", makerOrderId: "s1", takerAccountId: "a", makerAccountId: "a", takerSide: "BUY" },
    ]);
    expect(engine.snapshotView().asks[0]?.orders.map((item) => item.orderId)).toEqual(["s3"]);
  });

  it("removes an empty level and reports the true remaining after a partial fill", () => {
    const engine = new Engine(config);
    engine.apply(place("ask", "SELL", 100n, 5n));
    engine.apply(place("bid", "BUY", 100n, 2n, 2n));
    expect(engine.apply({ kind: "CANCEL", ts: 3n, orderId: "ask" })).toEqual([
      { type: "ORDER_CANCELLED", engineSeq: 5n, ts: 3n, orderId: "ask", remaining: 3n, reason: "USER_REQUEST" },
    ]);
    expect(engine.snapshotView()).toEqual({ bids: [], asks: [], bidPrices: [], askPrices: [] });
  });

  it("never reuses a cancelled order id", () => {
    const engine = new Engine(config);
    engine.apply(place("cancelled", "BUY", 100n, 1n));
    engine.apply({ kind: "CANCEL", ts: 2n, orderId: "cancelled" });
    expect(engine.apply(place("cancelled", "SELL", 100n, 1n, 3n))).toEqual([
      { type: "ORDER_REJECTED", engineSeq: 4n, ts: 3n, orderId: "cancelled", reason: "DUPLICATE_ORDER_ID" },
    ]);
  });

  it("U18 cancels head, middle and tail keeping FIFO and invariants", () => {
    for (const victim of ["o1", "o2", "o3"]) {
      const engine = new Engine(config);
      for (const id of ["o1", "o2", "o3"]) engine.apply(place(id, "SELL", 100n, 1n));
      engine.apply({ kind: "CANCEL", ts: 2n, orderId: victim });
      expect(engine.checkInvariants()).toEqual([]);
      const expected = ["o1", "o2", "o3"].filter((id) => id !== victim);
      const trades = engine.apply(place("t", "BUY", 100n, 2n)).filter((e) => e.type === "TRADE_EXECUTED");
      expect(trades.map((e) => (e.type === "TRADE_EXECUTED" ? e.makerOrderId : ""))).toEqual(expected);
      expect(engine.checkInvariants()).toEqual([]);
    }
  });

  it("U20 empty book queries", () => {
    const engine = new Engine(config);
    expect(engine.snapshotView().bidPrices).toEqual([]);
    expect(engine.depth("BUY", 5)).toEqual([]);
    expect(engine.restingOrders()).toEqual([]);
    expect(engine.checkInvariants()).toEqual([]);
  });

  it("depth, restingOrders and invariants after Example 1 steps 1-3", () => {
    const engine = new Engine(config);
    engine.apply(place("o1", "SELL", 101n, 5n));
    engine.apply(place("o2", "SELL", 101n, 3n));
    engine.apply(place("o3", "SELL", 102n, 4n));
    expect(engine.depth("SELL", 1).map((l) => [l.price, l.totalQuantity])).toEqual([[101n, 8n]]);
    expect(engine.restingOrders().map((o) => o.orderId)).toEqual(["o1", "o2", "o3"]);
    expect(engine.checkInvariants()).toEqual([]);
  });
});
