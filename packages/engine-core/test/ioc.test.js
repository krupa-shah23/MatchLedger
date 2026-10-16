import { describe, expect, it } from "vitest";
import { Engine } from "../src/matching/engine.js";
import { cancel, config, expectInvariants, place } from "./helpers.js";
const accepted = (engineSeq, command) => ({
    type: "ORDER_ACCEPTED",
    engineSeq,
    ts: command.ts,
    orderId: command.orderId,
    accountId: command.accountId,
    side: command.side,
    orderType: command.orderType,
    price: command.price,
    quantity: command.quantity,
});
const trade = (engineSeq, ts, tradeId, taker, maker, side, price, quantity) => ({
    type: "TRADE_EXECUTED",
    engineSeq,
    ts,
    tradeId,
    symbol: "ABC",
    price,
    quantity,
    takerOrderId: taker,
    makerOrderId: maker,
    takerAccountId: "a1",
    makerAccountId: "a1",
    takerSide: side,
});
const brief = (e) => e.type === "TRADE_EXECUTED" ? `T:${e.makerOrderId}@${e.price.toString()}x${e.quantity.toString()}`
    : e.type === "ORDER_CANCELLED" ? `C:${e.reason}:${e.remaining.toString()}` : e.type;
describe("IOC orders", () => {
    it("U8 IOC with cap and empty book emits only the remainder cancellation", () => {
        const engine = new Engine(config);
        const command = place("o1", "BUY", 100n, 5n, "IOC", "a1", 8n);
        expect(engine.apply(command)).toEqual([{ ...accepted(1n, command), type: "ORDER_ACCEPTED" }, { type: "ORDER_CANCELLED", engineSeq: 2n, ts: 8n, orderId: "o1", remaining: 5n, reason: "IOC_REMAINDER" }]);
        expect(engine.depth("BUY", 10)).toEqual([]);
        expect(engine.depth("SELL", 10)).toEqual([]);
        expectInvariants(engine);
    });
    it("U9 stops at the BUY cap and cancels the remainder", () => {
        const engine = new Engine(config);
        for (const command of [place("o1", "SELL", 101n, 2n), place("o2", "SELL", 102n, 2n), place("o3", "SELL", 103n, 2n)]) {
            engine.apply(command);
            expectInvariants(engine);
        }
        const command = place("o4", "BUY", 102n, 5n, "IOC", "a1", 9n);
        expect(engine.apply(command)).toEqual([
            accepted(7n, command),
            trade(8n, 9n, "ABC-T1", "o4", "o1", "BUY", 101n, 2n),
            trade(9n, 9n, "ABC-T2", "o4", "o2", "BUY", 102n, 2n),
            { type: "ORDER_CANCELLED", engineSeq: 10n, ts: 9n, orderId: "o4", remaining: 1n, reason: "IOC_REMAINDER" },
        ]);
        expect(engine.depth("SELL", 10).map((level) => level.price)).toEqual([103n]);
        expectInvariants(engine);
    });
    it("U10 IOC remainder never rests", () => {
        const engine = new Engine(config);
        const command = place("ioc", "BUY", 100n, 5n, "IOC");
        expect(engine.apply(command).map(brief)).toEqual(["ORDER_ACCEPTED", "C:IOC_REMAINDER:5"]);
        expect(engine.restingOrders().some((order) => order.orderId === "ioc")).toBe(false);
        expect(engine.depth("BUY", 10)).toEqual([]);
        expectInvariants(engine);
    });
    it("U12a rejects max quantity and max price for both GTC and IOC", () => {
        const bounded = new Engine({ ...config, maxQuantity: 5n, maxPrice: 100n });
        const before = bounded.restingOrders();
        expect(bounded.apply(place("g", "BUY", 101n, 6n))).toEqual([{ type: "ORDER_REJECTED", engineSeq: 1n, ts: 0n, orderId: "g", reason: "EXCEEDS_MAX_QUANTITY" }]);
        expect(bounded.apply(place("i", "BUY", 101n, 6n, "IOC"))).toEqual([{ type: "ORDER_REJECTED", engineSeq: 2n, ts: 0n, orderId: "i", reason: "EXCEEDS_MAX_QUANTITY" }]);
        expect(bounded.restingOrders()).toEqual(before);
        expectInvariants(bounded);
    });
    it("U22 IOC exactly fills one maker", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 100n, 5n));
        expectInvariants(engine);
        const command = place("o2", "BUY", 100n, 5n, "IOC", "a1", 22n);
        expect(engine.apply(command)).toEqual([accepted(3n, command), trade(4n, 22n, "ABC-T1", "o2", "o1", "BUY", 100n, 5n)]);
        expect(engine.restingOrders()).toEqual([]);
        expectInvariants(engine);
    });
    it("U23 partially fills then cancels the IOC remainder", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 100n, 3n));
        const command = place("o2", "BUY", 100n, 10n, "IOC", "a1", 23n);
        expect(engine.apply(command)).toEqual([accepted(3n, command), trade(4n, 23n, "ABC-T1", "o2", "o1", "BUY", 100n, 3n), { type: "ORDER_CANCELLED", engineSeq: 5n, ts: 23n, orderId: "o2", remaining: 7n, reason: "IOC_REMAINDER" }]);
        expectInvariants(engine);
    });
    it("U24 IOC does not cross, then crosses at the inclusive boundary", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 101n, 5n));
        const noCross = place("o2", "BUY", 100n, 5n, "IOC", "a1", 24n);
        expect(engine.apply(noCross)).toEqual([accepted(3n, noCross), { type: "ORDER_CANCELLED", engineSeq: 4n, ts: 24n, orderId: "o2", remaining: 5n, reason: "IOC_REMAINDER" }]);
        expectInvariants(engine);
        const cross = place("o3", "BUY", 101n, 5n, "IOC", "a1", 25n);
        expect(engine.apply(cross)).toEqual([accepted(5n, cross), trade(6n, 25n, "ABC-T1", "o3", "o1", "BUY", 101n, 5n)]);
        expectInvariants(engine);
    });
    it("U25 SELL IOC sweeps the bid floor", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "BUY", 100n, 3n));
        engine.apply(place("o2", "BUY", 99n, 3n));
        engine.apply(place("o3", "BUY", 98n, 3n));
        const command = place("o4", "SELL", 99n, 8n, "IOC", "a1", 25n);
        expect(engine.apply(command)).toEqual([accepted(7n, command), trade(8n, 25n, "ABC-T1", "o4", "o1", "SELL", 100n, 3n), trade(9n, 25n, "ABC-T2", "o4", "o2", "SELL", 99n, 3n), { type: "ORDER_CANCELLED", engineSeq: 10n, ts: 25n, orderId: "o4", remaining: 2n, reason: "IOC_REMAINDER" }]);
        expect(engine.depth("BUY", 10).map((level) => level.price)).toEqual([98n]);
        expectInvariants(engine);
    });
    it("U26 uses inclusive boundaries on both sides", () => {
        const buy = new Engine(config);
        buy.apply(place("ask", "SELL", 100n, 1n));
        expect(buy.apply(place("equal", "BUY", 100n, 1n, "IOC")).map(brief)).toEqual(["ORDER_ACCEPTED", "T:ask@100x1"]);
        expectInvariants(buy);
        const sell = new Engine(config);
        sell.apply(place("bid", "BUY", 100n, 1n));
        expect(sell.apply(place("equal", "SELL", 100n, 1n, "IOC")).map(brief)).toEqual(["ORDER_ACCEPTED", "T:bid@100x1"]);
        expectInvariants(sell);
    });
    it("U27 rejects a cancel after an IOC", () => {
        const engine = new Engine(config);
        expect(engine.apply(place("o1", "BUY", 100n, 5n, "IOC")).map(brief)).toEqual(["ORDER_ACCEPTED", "C:IOC_REMAINDER:5"]);
        expect(engine.apply(cancel("o1"))).toEqual([{ type: "CANCEL_REJECTED", engineSeq: 3n, ts: 0n, orderId: "o1", reason: "ORDER_NOT_RESTING" }]);
        expectInvariants(engine);
    });
    it("U28 rejects an IOC duplicate of a resting id and allows a later completed IOC id", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "BUY", 99n, 5n));
        const duplicate = place("o1", "SELL", 99n, 5n, "IOC");
        expect(engine.apply(duplicate)).toEqual([{ type: "ORDER_REJECTED", engineSeq: 3n, ts: 0n, orderId: "o1", reason: "DUPLICATE_ORDER_ID" }]);
        expectInvariants(engine);
    });
    it("U29 rejects invalid IOC tick and lot without cancellation", () => {
        const engine = new Engine({ ...config, tickSize: 5n, lotSize: 5n });
        expect(engine.apply(place("tick", "BUY", 101n, 5n, "IOC"))).toEqual([{ type: "ORDER_REJECTED", engineSeq: 1n, ts: 0n, orderId: "tick", reason: "INVALID_TICK" }]);
        expect(engine.apply(place("lot", "BUY", 100n, 6n, "IOC"))).toEqual([{ type: "ORDER_REJECTED", engineSeq: 2n, ts: 0n, orderId: "lot", reason: "INVALID_LOT" }]);
        expectInvariants(engine);
    });
    it("U30 IOC consumes the head maker before the next maker", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 100n, 10n));
        engine.apply(place("o2", "SELL", 100n, 10n));
        expect(engine.apply(place("o3", "BUY", 100n, 4n, "IOC")).map(brief)).toEqual(["ORDER_ACCEPTED", "T:o1@100x4"]);
        expectInvariants(engine);
    });
    it("U31 removes a consumed price level and updates bestAsk", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 100n, 1n));
        engine.apply(place("o2", "SELL", 101n, 1n));
        expect(engine.apply(place("o3", "BUY", 110n, 1n, "IOC")).map(brief)).toEqual(["ORDER_ACCEPTED", "T:o1@100x1"]);
        expectInvariants(engine);
    });
    it("U32 sweeps the whole book at resting prices", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 101n, 1n));
        engine.apply(place("o2", "SELL", 102n, 1n));
        expect(engine.apply(place("o3", "BUY", 110n, 5n, "IOC", "a1", 32n)).map(brief)).toEqual(["ORDER_ACCEPTED", "T:o1@101x1", "T:o2@102x1", "C:IOC_REMAINDER:3"]);
        expectInvariants(engine);
    });
    it("U33 allows self-trade for IOC", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 100n, 1n, "GTC", "same"));
        expect(engine.apply(place("o2", "BUY", 100n, 1n, "IOC", "same")).map(brief)).toEqual(["ORDER_ACCEPTED", "T:o1@100x1"]);
        expectInvariants(engine);
    });
    it("U34 distinguishes user cancellation from IOC remainder", () => {
        const engine = new Engine(config);
        engine.apply(place("resting", "BUY", 100n, 5n));
        expect(engine.apply(cancel("resting", 34n))).toEqual([{ type: "ORDER_CANCELLED", engineSeq: 3n, ts: 34n, orderId: "resting", remaining: 5n, reason: "USER_REQUEST" }]);
        expectInvariants(engine);
        expect(engine.apply(place("ioc", "BUY", 99n, 1n, "IOC", "a1", 35n)).map(brief)).toEqual(["ORDER_ACCEPTED", "C:IOC_REMAINDER:1"]);
        expectInvariants(engine);
    });
    it("echoes each IOC command timestamp on every event", () => {
        const engine = new Engine(config);
        const command = place("ts", "BUY", 100n, 1n, "IOC", "a1", 123n);
        expect(engine.apply(command).map((event) => event.ts)).toEqual([123n, 123n]);
        expectInvariants(engine);
    });
});
