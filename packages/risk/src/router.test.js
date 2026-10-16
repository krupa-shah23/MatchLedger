import { describe, expect, it } from "vitest";
import { MarketView } from "./market-view.js";
import { EngineEventRouter } from "./router.js";
const output = (symbol, seq, events) => ({
    symbol,
    seq,
    ts: seq * 10,
    command: { kind: "PLACE", ts: 1n, orderId: "x", accountId: "a", side: "BUY", orderType: "LIMIT", timeInForce: "GTC", price: 100n, quantity: 1n },
    events: events,
});
const rested = (orderId, side, price, remaining) => ({
    type: "ORDER_RESTED",
    engineSeq: 1n,
    ts: 1n,
    orderId,
    side,
    price,
    remaining,
});
const trade = (tradeId, takerOrderId, makerOrderId, takerSide, price, quantity, extra = {}) => ({
    type: "TRADE_EXECUTED",
    engineSeq: 2n,
    ts: 2n,
    tradeId,
    symbol: "ACME",
    price,
    quantity,
    takerOrderId,
    makerOrderId,
    takerAccountId: takerSide === "BUY" ? "buyer" : "maker",
    makerAccountId: takerSide === "BUY" ? "maker" : "buyer",
    takerSide,
    ...extra,
});
const cancelled = (orderId, remaining, reason) => ({
    type: "ORDER_CANCELLED",
    engineSeq: 3n,
    ts: 3n,
    orderId,
    remaining,
    reason,
});
const rejected = (orderId, reason) => ({
    type: "ORDER_REJECTED",
    engineSeq: 4n,
    ts: 4n,
    orderId,
    reason,
});
const cancelRejected = (orderId) => ({
    type: "CANCEL_REJECTED",
    engineSeq: 5n,
    ts: 5n,
    orderId,
    reason: "ORDER_NOT_RESTING",
});
describe("engine event router", () => {
    it("RT1: OrderRested maps to OrderAcked", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("o1", { accountId: "A", symbol: "ACME", side: "BUY" });
        const result = router.onShardOutputs([output("ACME", 1, [rested("o1", "BUY", 100n, 5n)])]);
        expect(result.notices).toStrictEqual([{ accountId: "A", command: { type: "OrderAcked", orderId: "o1" } }]);
    });
    it("RT2: TradeExecuted emits fills to taker and maker, and records the trade posting", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("t1", { accountId: "buyer", symbol: "ACME", side: "BUY" });
        router.registerOrder("m1", { accountId: "maker", symbol: "ACME", side: "SELL" });
        const result = router.onShardOutputs([
            output("ACME", 1, [trade("tr1", "t1", "m1", "BUY", 102n, 3n)]),
        ]);
        expect(result.notices).toStrictEqual([
            { accountId: "buyer", command: { type: "FillApplied", orderId: "t1", tradeId: "tr1", price: 102n, quantity: 3n } },
            { accountId: "maker", command: { type: "FillApplied", orderId: "m1", tradeId: "tr1", price: 102n, quantity: 3n } },
        ]);
        expect(result.trades).toStrictEqual([
            {
                tradeId: "tr1",
                symbol: "ACME",
                price: 102n,
                quantity: 3n,
                buyerAccountId: "buyer",
                sellerAccountId: "maker",
                ts: 10,
            },
        ]);
    });
    it("RT3: OrderCancelled and OrderRejected map to the correct account commands", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("c1", { accountId: "acc1", symbol: "ACME", side: "BUY" });
        router.registerOrder("r1", { accountId: "acc2", symbol: "ACME", side: "SELL" });
        const result = router.onShardOutputs([
            output("ACME", 1, [cancelled("c1", 2n, "USER_REQUEST")]),
            output("ACME", 2, [rejected("r1", "INVALID_QUANTITY")]),
        ]);
        expect(result.notices).toStrictEqual([
            { accountId: "acc1", command: { type: "OrderClosed", orderId: "c1", remaining: 2n, reason: "CANCELLED" } },
            { accountId: "acc2", command: { type: "OrderRejectedByMatcher", orderId: "r1", reason: "INVALID_QUANTITY" } },
        ]);
    });
    it("RT4: duplicate outputs are ignored once and counted", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("o1", { accountId: "A", symbol: "ACME", side: "BUY" });
        const batch = output("ACME", 1, [rested("o1", "BUY", 100n, 5n)]);
        const first = router.onShardOutputs([batch]);
        const second = router.onShardOutputs([batch]);
        expect(first.notices).toHaveLength(1);
        expect(second.notices).toStrictEqual([]);
        expect(router.counters.duplicateOutputs).toBe(1);
    });
    it("RT5: unregistered order events are counted and ignored", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        const result = router.onShardOutputs([output("ACME", 1, [rested("ghost", "BUY", 100n, 5n)])]);
        expect(result.ignoredOrders).toBe(1);
        expect(router.counters.unknownOrderEvents).toBe(1);
    });
    it("RT6: fully filled orders are removed from the owner map, partial fills remain", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("t1", { accountId: "buyer", symbol: "ACME", side: "BUY" });
        router.registerOrder("m1", { accountId: "maker", symbol: "ACME", side: "SELL" });
        router.registerOrder("keep", { accountId: "keeper", symbol: "ACME", side: "BUY" });
        router.onShardOutputs([
            output("ACME", 1, [trade("tr1", "t1", "m1", "BUY", 100n, 5n, { takerRemaining: 0n, makerRemaining: 0n })]),
            output("ACME", 2, [rested("keep", "BUY", 90n, 2n)]),
            output("ACME", 3, [trade("tr2", "keep", "m2", "BUY", 90n, 1n, { takerRemaining: 1n, makerRemaining: 0n })]),
        ]);
        expect(router.ownerOf("t1")).toBeUndefined();
        expect(router.ownerOf("m1")).toBeUndefined();
        expect(router.ownerOf("keep")).toBeDefined();
    });
    it("RT7: sweep-initated cancel rejections produce ReleaseUnreached", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("s1", { accountId: "sweeper", symbol: "ACME", side: "BUY" });
        router.markSweepCancel("s1");
        const result = router.onShardOutputs([output("ACME", 1, [cancelRejected("s1")])]);
        expect(result.notices).toStrictEqual([{ accountId: "sweeper", command: { type: "ReleaseUnreached", orderId: "s1" } }]);
    });
    it("RT8: self-trade sends notices to the same account twice", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("self1", { accountId: "same", symbol: "ACME", side: "BUY" });
        router.registerOrder("self2", { accountId: "same", symbol: "ACME", side: "SELL" });
        const result = router.onShardOutputs([
            output("ACME", 1, [trade("tr1", "self1", "self2", "BUY", 100n, 2n)]),
        ]);
        expect(result.notices).toStrictEqual([
            { accountId: "same", command: { type: "FillApplied", orderId: "self1", tradeId: "tr1", price: 100n, quantity: 2n } },
            { accountId: "same", command: { type: "FillApplied", orderId: "self2", tradeId: "tr1", price: 100n, quantity: 2n } },
        ]);
    });
    it("RT9: notices preserve event order and MarketView sees earlier events in the same batch", () => {
        const marketView = new MarketView();
        const router = new EngineEventRouter({ marketView });
        router.registerOrder("b1", { accountId: "buyer", symbol: "ACME", side: "BUY" });
        router.registerOrder("a1", { accountId: "seller", symbol: "ACME", side: "SELL" });
        const batch = output("ACME", 1, [
            rested("a1", "SELL", 102n, 3n),
            rested("b1", "BUY", 100n, 5n),
            trade("tr1", "b1", "a1", "BUY", 102n, 3n),
        ]);
        const result = router.onShardOutputs([batch]);
        expect(result.notices[0]).toEqual({ accountId: "seller", command: { type: "OrderAcked", orderId: "a1" } });
        expect(marketView.snapshotFor("ACME")).toEqual({ lastTradePrice: 102n, lastTradeTs: 10, bestBid: 100n });
    });
    it("RT10: HALT_TIMEOUT cancellations release reservations as OrderClosed with the halt timeout reason", () => {
        const router = new EngineEventRouter({ marketView: new MarketView() });
        router.registerOrder("h1", { accountId: "holder", symbol: "ACME", side: "BUY" });
        const result = router.onShardOutputs([
            output("ACME", 1, [{ type: "ORDER_CANCELLED", engineSeq: 9n, ts: 9n, orderId: "h1", remaining: 2n, reason: "HALT_TIMEOUT" }]),
        ]);
        expect(result.notices).toStrictEqual([
            { accountId: "holder", command: { type: "OrderClosed", orderId: "h1", remaining: 2n, reason: "HALT_TIMEOUT" } },
        ]);
    });
});
