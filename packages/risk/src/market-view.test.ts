import { describe, expect, it } from "vitest";

import { MarketView } from "./market-view.js";

type TradeQuery = {
  readonly takerOrderId: string;
  readonly makerOrderId: string;
  readonly takerAccountId: string;
  readonly makerAccountId: string;
  readonly takerSide: "BUY" | "SELL";
  readonly quantity: bigint;
  readonly makerRemaining?: bigint;
};

const rested = (orderId: string, side: "BUY" | "SELL", price: bigint, remaining: bigint): Parameters<MarketView["apply"]>[1] => ({
  type: "ORDER_RESTED",
  engineSeq: 1n,
  ts: 1n,
  orderId,
  side,
  price,
  remaining,
} as unknown as Parameters<MarketView["apply"]>[1]);

const trade = (tradeId: string, query: TradeQuery): Parameters<MarketView["apply"]>[1] => ({
  type: "TRADE_EXECUTED",
  engineSeq: 2n,
  ts: 2n,
  tradeId,
  symbol: "ACME",
  price: 102n,
  quantity: query.quantity,
  takerOrderId: query.takerOrderId,
  makerOrderId: query.makerOrderId,
  takerAccountId: query.takerAccountId,
  makerAccountId: query.makerAccountId,
  takerSide: query.takerSide,
  makerRemaining: query.makerRemaining,
} as unknown as Parameters<MarketView["apply"]>[1]);

describe("market view", () => {
  it("MV1: best bid and ask are tracked from rested orders", () => {
    const view = new MarketView();
    view.apply("ACME", rested("b1", "BUY", 100n, 5n), 10);
    view.apply("ACME", rested("a1", "SELL", 102n, 3n), 10);
    expect(view.snapshotFor("ACME")).toEqual({ bestBid: 100n, bestAsk: 102n });
  });

  it("MV2: trade updates last trade and removes the maker level", () => {
    const view = new MarketView();
    view.apply("ACME", rested("a1", "SELL", 102n, 3n), 10);
    view.apply("ACME", trade("t1", { takerOrderId: "b1", makerOrderId: "a1", takerAccountId: "buyer", makerAccountId: "seller", takerSide: "BUY", quantity: 3n, makerRemaining: 0n }), 11);
    expect(view.snapshotFor("ACME")).toEqual({ lastTradePrice: 102n, lastTradeTs: 11, bestAsk: undefined, bestBid: undefined });
  });

  it("MV3: cancels remove orders and levels", () => {
    const view = new MarketView();
    view.apply("ACME", rested("a1", "SELL", 103n, 2n), 10);
    const cancelledEvent = {
      type: "ORDER_CANCELLED",
      engineSeq: 3n,
      ts: 3n,
      orderId: "a1",
      remaining: 2n,
      reason: "USER_REQUEST",
    } as unknown as Parameters<MarketView["apply"]>[1];
    view.apply("ACME", cancelledEvent, 12);
    expect(view.snapshotFor("ACME")).toEqual({});
  });

  it("MV4: maker partial fill reduces the resting quantity in place", () => {
    const view = new MarketView();
    view.apply("ACME", rested("a1", "SELL", 100n, 5n), 10);
    view.apply("ACME", trade("t1", { takerOrderId: "b1", makerOrderId: "a1", takerAccountId: "buyer", makerAccountId: "seller", takerSide: "BUY", quantity: 2n, makerRemaining: 3n }), 11);
    expect(view.snapshotFor("ACME")).toEqual({ lastTradePrice: 102n, lastTradeTs: 11, bestAsk: 100n });
  });
});
