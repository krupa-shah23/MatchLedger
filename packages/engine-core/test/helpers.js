import { expect } from "vitest";
import { Engine } from "../src/matching/engine.js";
export const config = {
    symbol: "ABC",
    tickSize: 1n,
    lotSize: 1n,
    maxQuantity: 1000n,
    maxPrice: 10000n,
};
export const place = (orderId, side, price, quantity, timeInForce = "GTC", accountId = "a1", ts = 0n) => ({
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
export const cancel = (orderId, ts = 0n) => ({
    kind: "CANCEL",
    ts,
    orderId,
});
export const expectInvariants = (engine) => {
    expect(engine.checkInvariants(), engine.checkInvariants().join("; ")).toEqual([]);
};
export const expectStub = (engine, command) => {
    expect(() => engine.apply(command)).toThrow("IOC matching is not implemented");
    expectInvariants(engine);
};
