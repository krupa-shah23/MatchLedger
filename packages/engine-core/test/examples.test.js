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
describe("Week 2 carry-over examples", () => {
    it("EX1: sweeps levels, rests, trades at resting prices, and cancels", () => {
        const engine = new Engine(config);
        const o1 = place("o1", "SELL", 101n, 5n, "GTC", "a1", 1n);
        const o2 = place("o2", "SELL", 101n, 3n, "GTC", "a1", 2n);
        const o3 = place("o3", "SELL", 102n, 4n, "GTC", "a1", 3n);
        const o4 = place("o4", "BUY", 102n, 10n, "GTC", "a1", 4n);
        const o5 = place("o5", "BUY", 100n, 6n, "GTC", "a1", 5n);
        const o6 = place("o6", "SELL", 99n, 4n, "GTC", "a1", 6n);
        expect(engine.apply(o1)).toEqual([accepted(1n, o1), { type: "ORDER_RESTED", engineSeq: 2n, ts: 1n, orderId: "o1", side: "SELL", price: 101n, remaining: 5n }]);
        expect(engine.apply(o2)).toEqual([accepted(3n, o2), { type: "ORDER_RESTED", engineSeq: 4n, ts: 2n, orderId: "o2", side: "SELL", price: 101n, remaining: 3n }]);
        expect(engine.apply(o3)).toEqual([accepted(5n, o3), { type: "ORDER_RESTED", engineSeq: 6n, ts: 3n, orderId: "o3", side: "SELL", price: 102n, remaining: 4n }]);
        expect(engine.apply(o4)).toEqual([
            accepted(7n, o4),
            { type: "TRADE_EXECUTED", engineSeq: 8n, ts: 4n, tradeId: "ABC-T1", symbol: "ABC", price: 101n, quantity: 5n, takerOrderId: "o4", makerOrderId: "o1", takerAccountId: "a1", makerAccountId: "a1", takerSide: "BUY" },
            { type: "TRADE_EXECUTED", engineSeq: 9n, ts: 4n, tradeId: "ABC-T2", symbol: "ABC", price: 101n, quantity: 3n, takerOrderId: "o4", makerOrderId: "o2", takerAccountId: "a1", makerAccountId: "a1", takerSide: "BUY" },
            { type: "TRADE_EXECUTED", engineSeq: 10n, ts: 4n, tradeId: "ABC-T3", symbol: "ABC", price: 102n, quantity: 2n, takerOrderId: "o4", makerOrderId: "o3", takerAccountId: "a1", makerAccountId: "a1", takerSide: "BUY" },
        ]);
        expect(engine.apply(o5)).toEqual([accepted(11n, o5), { type: "ORDER_RESTED", engineSeq: 12n, ts: 5n, orderId: "o5", side: "BUY", price: 100n, remaining: 6n }]);
        expect(engine.apply(o6)).toEqual([
            accepted(13n, o6),
            { type: "TRADE_EXECUTED", engineSeq: 14n, ts: 6n, tradeId: "ABC-T4", symbol: "ABC", price: 100n, quantity: 4n, takerOrderId: "o6", makerOrderId: "o5", takerAccountId: "a1", makerAccountId: "a1", takerSide: "SELL" },
        ]);
        expect(engine.apply(cancel("o5", 7n))).toEqual([{ type: "ORDER_CANCELLED", engineSeq: 15n, ts: 7n, orderId: "o5", remaining: 2n, reason: "USER_REQUEST" }]);
        expect(engine.apply(cancel("o5", 8n))).toEqual([{ type: "CANCEL_REJECTED", engineSeq: 16n, ts: 8n, orderId: "o5", reason: "ORDER_NOT_RESTING" }]);
        expect(engine.depth("BUY", 10)).toEqual([]);
        expect(engine.depth("SELL", 10)).toEqual([{ price: 102n, totalQuantity: 2n, orders: [{ orderId: "o3", accountId: "a1", remaining: 2n, arrivalSeq: 3n }] }]);
        expect(engine.restingOrders()).toEqual([{ orderId: "o3", accountId: "a1", side: "SELL", price: 102n, remaining: 2n, arrivalSeq: 3n }]);
        expectInvariants(engine);
    });
    it("EX2: preserves FIFO when a maker is partially filled", () => {
        const engine = new Engine(config);
        engine.apply(place("o1", "SELL", 100n, 5n, "GTC", "a1", 1n));
        engine.apply(place("o2", "SELL", 100n, 5n, "GTC", "a1", 2n));
        expect(engine.apply(place("o3", "BUY", 100n, 3n, "GTC", "a1", 3n))).toHaveLength(2);
        expect(engine.depth("SELL", 10)[0]?.orders.map((order) => [order.orderId, order.remaining])).toEqual([["o1", 2n], ["o2", 5n]]);
        expect(engine.apply(place("o4", "BUY", 100n, 3n, "GTC", "a1", 4n)).map((event) => event.type)).toEqual(["ORDER_ACCEPTED", "TRADE_EXECUTED", "TRADE_EXECUTED"]);
        expect(engine.depth("SELL", 10)[0]?.orders.map((order) => [order.orderId, order.remaining])).toEqual([["o2", 4n]]);
        expectInvariants(engine);
    });
    it("EX3: head, middle, and tail cancellation preserve FIFO", () => {
        for (const victim of ["o1", "o2", "o3"]) {
            const engine = new Engine(config);
            for (const id of ["o1", "o2", "o3"])
                engine.apply(place(id, "SELL", 100n, 1n));
            engine.apply(cancel(victim));
            const expected = ["o1", "o2", "o3"].filter((id) => id !== victim);
            const trades = engine.apply(place("t", "BUY", 100n, 2n)).filter((event) => event.type === "TRADE_EXECUTED");
            expect(trades.map((event) => event.type === "TRADE_EXECUTED" ? event.makerOrderId : "")).toEqual(expected);
            expectInvariants(engine);
        }
    });
});
