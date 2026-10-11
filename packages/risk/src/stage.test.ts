import { describe, expect, it } from "vitest";

import { RiskStage } from "./stage.js";
import { InMemoryRiskJournal } from "./in-memory-risk-journal.js";
import { RiskStamper } from "./stamper.js";

const config = {
  instruments: new Map([
    ["ACME", { symbol: "ACME", tickSize: 1n, protectionBandBps: 100n, maxBandBps: 200n, maxReferenceAgeMs: 200 }],
  ]),
};

describe("risk stage basics", () => {
  it("stamps sequences contiguously and never moves backwards", () => {
    let now = 10;
    const clock = { now: () => now };
    const stamper = new RiskStamper(clock);
    const first = stamper.stamp(0, { type: "OpenAccount", accountId: "a" });
    now = 5;
    const second = stamper.stamp(0, { type: "OpenAccount", accountId: "b" });
    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(second.ts).toBe(10);
  });

  it("accepts an account and a submit order with the market input attached before journal append", async () => {
    const journal = new InMemoryRiskJournal();
    const marketCalls: string[] = [];
    const stage = new RiskStage({
      partitions: 2,
      config,
      clock: { now: () => 50 },
      journalFor: () => journal,
      outbox: { publish: async () => undefined },
      marketInput: (symbol) => {
        marketCalls.push(symbol);
        return { lastTradePrice: 100n, lastTradeTs: 30, bestBid: 95n, bestAsk: 105n };
      },
      commandCapacity: 8,
      maxBatch: 2,
    });

    stage.start();
    expect(stage.openAccount("acct-1")).toBe("ACCEPTED");
    expect(stage.submit({
      orderId: "o-1",
      accountId: "acct-1",
      symbol: "ACME",
      side: "BUY",
      kind: "LIMIT",
      timeInForce: "GTC",
      quantity: 2n,
      price: 100n,
    })).toBe("ACCEPTED");
    await stage.stop({ drain: true });

    expect(marketCalls).toContain("ACME");
    expect(journal.all()).toHaveLength(2);
    expect(stage.state).toBe("STOPPED");
  });
});
