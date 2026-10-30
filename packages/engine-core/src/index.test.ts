import { describe, it, expect } from "vitest";
import { Engine, type InstrumentConfig, type PlaceOrder } from "./index.js";

describe("engine-core", () => {
  it("exports a working Engine and matching types from the package barrel", () => {
    const config: InstrumentConfig = {
      symbol: "ABC",
      tickSize: 1n,
      lotSize: 1n,
      maxQuantity: 1_000n,
      maxPrice: 10_000n,
    };
    const engine = new Engine(config);

    const sell: PlaceOrder = {
      kind: "PLACE",
      ts: 1n,
      orderId: "s1",
      accountId: "a",
      side: "SELL",
      orderType: "LIMIT",
      timeInForce: "GTC",
      price: 100n,
      quantity: 5n,
    };
    const buy: PlaceOrder = { ...sell, orderId: "b1", side: "BUY", ts: 2n, accountId: "b" };

    engine.apply(sell);
    const events = engine.apply(buy);

    expect(events.some((event) => event.type === "TRADE_EXECUTED")).toBe(true);
    expect(engine.checkInvariants()).toEqual([]);
  });
});
