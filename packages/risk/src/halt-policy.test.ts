import { describe, expect, it } from "vitest";
import { RiskCore } from "./core/risk-core.js";

const cfg = { instruments: new Map([["T", { symbol: "T", tickSize: 1n, protectionBandBps: 100n, maxBandBps: 200n, maxReferenceAgeMs: 200 }]]) };

describe("halt policy (HA series)", () => {
  it("HA1: HaltSymbol marks symbol halted", () => {
    const c = new RiskCore(cfg);
    c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
    c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "HaltSymbol", symbol: "T", reason: "x" } });
    expect(c.haltedSymbols.has("T")).toBe(true);
  });

  it("HA2: SYMBOL_HALTED rejection before reservation", () => {
    const c = new RiskCore(cfg);
    c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
    c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "Deposit", accountId: "a", asset: "CASH", amount: 1000n, requestId: "d1" } });
    c.haltedSymbols.add("T");
    const ev = c.apply({ partition: 0, seq: 3, ts: 50, command: { type: "SubmitOrder", orderId: "o1", accountId: "a", symbol: "T", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 10n, price: 100n, market: { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n } } });
    expect(ev.some(e => e.type === "OrderRejected" && (e as any).reason === "SYMBOL_HALTED")).toBe(true);
    expect(c.reservations.size).toBe(0);
  });

  it("HA3: Cancels release reservations", () => {
    const c = new RiskCore(cfg);
    c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
    c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "Deposit", accountId: "a", asset: "CASH", amount: 1000n, requestId: "d1" } });
    c.apply({ partition: 0, seq: 3, ts: 50, command: { type: "SubmitOrder", orderId: "o1", accountId: "a", symbol: "T", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 10n, price: 100n, market: { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n } } });
    const held1 = c.view("a").heldCash;
    c.haltedSymbols.add("T");
    const ev = c.apply({ partition: 0, seq: 4, ts: 50, command: { type: "OrderClosed", orderId: "o1", remaining: 10n, reason: "CANCELLED" } });
    const held2 = c.view("a").heldCash;
    expect(held1).toBeGreaterThan(0n);
    expect(held2).toBeLessThan(held1);
  });

  it("HA4: HALT_TIMEOUT reason releases", () => {
    const c = new RiskCore(cfg);
    c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
    c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "Deposit", accountId: "a", asset: "CASH", amount: 1000n, requestId: "d1" } });
    c.apply({ partition: 0, seq: 3, ts: 50, command: { type: "SubmitOrder", orderId: "o1", accountId: "a", symbol: "T", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 10n, price: 100n, market: { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n } } });
    const ev = c.apply({ partition: 0, seq: 4, ts: 50, command: { type: "OrderClosed", orderId: "o1", remaining: 10n, reason: "HALT_TIMEOUT" } });
    expect(ev.some(e => e.type === "ReservationReleased")).toBe(true);
  });

  it("HA5: heldBySymbol per symbol", () => {
    const c = new RiskCore(cfg);
    c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
    c.apply({ partition: 0, seq: 2, ts: 50, command: { type: "Deposit", accountId: "a", asset: "CASH", amount: 1000n, requestId: "d1" } });
    c.apply({ partition: 0, seq: 3, ts: 50, command: { type: "SubmitOrder", orderId: "o1", accountId: "a", symbol: "T", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 10n, price: 100n, market: { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n } } });
    const v = c.view("a");
    expect(v.heldBySymbol.some(x => x.symbol === "T" && x.amount > 0n)).toBe(true);
  });

  it("HA6: snapshot preserves halted", () => {
    const c = new RiskCore(cfg);
    c.apply({ partition: 0, seq: 1, ts: 50, command: { type: "OpenAccount", accountId: "a" } });
    c.haltedSymbols.add("T");
    const s = c.snapshot();
    expect(s.haltedSymbols).toContain("T");
  });
});
