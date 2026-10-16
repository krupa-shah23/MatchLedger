import { describe, expect, it } from "vitest";
import { BoundedQueue, partitionOf } from "@matchledger/common";
import { RiskCore } from "@matchledger/risk";
import { wirePipeline } from "../src/wire.js";
describe("system-tests smoke", () => {
    it("imports resolve across the allowed package graph", () => {
        const queue = new BoundedQueue(2);
        const value = partitionOf("acct-1", 4);
        const command = {
            kind: "PLACE",
            ts: 0n,
            orderId: "o-1",
            accountId: "acct-1",
            side: "BUY",
            orderType: "IOC",
            timeInForce: "IOC",
            price: 101n,
            quantity: 1n,
        };
        expect(queue.tryEnqueue("ready")).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(command.orderId).toBe("o-1");
        expect(typeof RiskCore).toBe("function");
        expect(wirePipeline()).toContain("risk-stage");
    });
    it("X6: Scenario 5 t3 resolves end to end in risk -> ledger -> break status order", async () => {
        const workflow = { status: "OPEN", breakId: "t3" };
        const ledger = new Map([["BUYER:CASH", 1000n], ["@SUSPENSE:CASH", 0n]]);
        const risk = new Map([["BUYER:CASH", 1000n], ["@SUSPENSE:CASH", 0n]]);
        const order = [];
        const executor = async (input) => {
            order.push("risk");
            risk.set(`${input.accountId}:${input.asset}`, (risk.get(`${input.accountId}:${input.asset}`) ?? 0n) + input.amount);
            order.push("ledger");
            ledger.set(`${input.accountId}:${input.asset}`, (ledger.get(`${input.accountId}:${input.asset}`) ?? 0n) + input.amount);
            ledger.set(`@SUSPENSE:${input.asset}`, (ledger.get(`@SUSPENSE:${input.asset}`) ?? 0n) - input.amount);
            order.push("break");
            workflow.status = "RESOLVED";
            return { accepted: true };
        };
        const result = await (await import("../../recon/src/service.js")).resolveBreak({
            workflow,
            breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
            actor: "ops",
            reason: "price mismatch",
            adjustment: { adjustmentId: "adj-t3", accountId: "BUYER", asset: "CASH", amount: -250n, side: "BUYER" },
            executor,
        });
        expect(order).toStrictEqual(["risk", "ledger", "break"]);
        expect(risk.get("BUYER:CASH")).toBe(750n);
        expect(ledger.get("BUYER:CASH")).toBe(750n);
        expect(ledger.get("@SUSPENSE:CASH")).toBe(250n);
        expect(result.status).toBe("RESOLVED");
        expect(result.workflow.status).toBe("RESOLVED");
        const rejected = await (await import("../../recon/src/service.js")).resolveBreak({
            workflow: { breakId: "t3", status: "OPEN" },
            breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
            actor: "ops",
            reason: "zero amount",
            adjustment: { adjustmentId: "adj-bad", accountId: "BUYER", asset: "CASH", amount: 0n, side: "BUYER" },
            executor: async () => ({ accepted: false, reason: "ZERO_AMOUNT" }),
        });
        expect(rejected.status).toBe("ADJUSTMENT_REJECTED");
        expect(rejected.workflow.status).toBe("OPEN");
    });
    it("K10: halt with resting orders reserves cash", () => {
        const cfg = { instruments: new Map([["T", { symbol: "T", tickSize: 1n, protectionBandBps: 100n, maxBandBps: 200n, maxReferenceAgeMs: 200 }]]) };
        const c = new RiskCore(cfg);
        c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "buyer" } });
        c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "Deposit", accountId: "buyer", asset: "CASH", amount: 10000n, requestId: "d1" } });
        c.apply({ partition: 0, seq: 3, ts: 50, command: { type: "SubmitOrder", orderId: "o1", accountId: "buyer", symbol: "T", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 10n, price: 100n, market: { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n } } });
        expect(c.reservations.size).toBeGreaterThan(0);
    });
    it("K11: halted order rejected before risk accepts", () => {
        const cfg = { instruments: new Map([["T", { symbol: "T", tickSize: 1n, protectionBandBps: 100n, maxBandBps: 200n, maxReferenceAgeMs: 200 }]]) };
        const c = new RiskCore(cfg);
        c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
        c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "Deposit", accountId: "a", asset: "CASH", amount: 1000n, requestId: "d1" } });
        c.haltedSymbols.add("T");
        const ev = c.apply({ partition: 0, seq: 3, ts: 50, command: { type: "SubmitOrder", orderId: "o1", accountId: "a", symbol: "T", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 10n, price: 100n, market: { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n } } });
        expect(ev.some(e => e.type === "OrderRejected")).toBe(true);
    });
    it("K12: halt_timeout releases all reserves", () => {
        const cfg = { instruments: new Map([["T", { symbol: "T", tickSize: 1n, protectionBandBps: 100n, maxBandBps: 200n, maxReferenceAgeMs: 200 }]]) };
        const c = new RiskCore(cfg);
        c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
        c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "Deposit", accountId: "a", asset: "CASH", amount: 10000n, requestId: "d1" } });
        c.apply({ partition: 0, seq: 3, ts: 50, command: { type: "SubmitOrder", orderId: "o1", accountId: "a", symbol: "T", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 10n, price: 100n, market: { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n } } });
        const h1 = c.view("a").heldCash;
        c.apply({ partition: 0, seq: 4, ts: 50, command: { type: "OrderClosed", orderId: "o1", remaining: 10n, reason: "HALT_TIMEOUT" } });
        const h2 = c.view("a").heldCash;
        expect(h1).toBeGreaterThan(0n);
        expect(h2).toBe(0n);
    });
});
