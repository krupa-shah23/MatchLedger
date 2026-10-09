import { expect } from "vitest";
import { Engine } from "../src/matching/engine.js";
import type { InstrumentConfig, PlaceOrder, TimeInForce } from "../src/matching/types.js";

export const config: InstrumentConfig = {
  symbol: "ABC",
  tickSize: 1n,
  lotSize: 1n,
  maxQuantity: 1_000n,
  maxPrice: 10_000n,
};

export const place = (
  orderId: string,
  side: "BUY" | "SELL",
  price: bigint,
  quantity: bigint,
  timeInForce: TimeInForce = "GTC",
  accountId = "a1",
  ts = 0n,
): PlaceOrder => ({
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

export const cancel = (orderId: string, ts = 0n) => ({
  kind: "CANCEL" as const,
  ts,
  orderId,
});

export const expectInvariants = (engine: Engine): void => {
  expect(engine.checkInvariants(), engine.checkInvariants().join("; ")).toEqual([]);
};

export const expectStub = (engine: Engine, command: PlaceOrder): void => {
  expect(() => engine.apply(command)).toThrow("IOC matching is not implemented");
  expectInvariants(engine);
};
