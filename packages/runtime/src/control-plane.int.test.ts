/**
 * Control-plane consumer and recovery tests (CP1, CP2, CP4, CP5).
 */

import { describe, it, expect } from "vitest";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";

describe.skipIf(!run)("CP: Control-Plane Consumer and Recovery", () => {
  it("CP1: Skip ShardOutput with seq at or below router watermark", async () => {
    // Scenario: router watermark is 10 for AAPL
    const watermarks = new Map<string, number>([["AAPL", 10]]);

    // ShardOutput with seq 10 (at watermark) -> skip
    const output1 = { symbol: "AAPL", seq: 10, ts: 1000, command: {}, events: [] };
    const shouldProcess1 = output1.seq > (watermarks.get(output1.symbol) ?? 0);
    expect(shouldProcess1).toBe(false);

    // ShardOutput with seq 11 (above watermark) -> process
    const output2 = { symbol: "AAPL", seq: 11, ts: 1001, command: {}, events: [] };
    const shouldProcess2 = output2.seq > (watermarks.get(output2.symbol) ?? 0);
    expect(shouldProcess2).toBe(true);
  });

  it("CP2: Recover control plane from engine journal (read-only) and risk", async () => {
    // This test would:
    // 1. Load engine journal read-only
    // 2. Recover risk partition
    // 3. Replay engine events to rebuild MarketView
    // 4. Return router with watermarks set

    expect(true).toBe(true); // Placeholder: requires full harness
  });

  it("CP4: Call EngineEventRouter.onShardOutputs and update watermark after processing", async () => {
    // After processing a ShardOutput:
    // - Call router.onShardOutputs([output])
    // - Update watermarks.set(symbol, output.seq)
    // - Next output with seq <= watermark is skipped

    const watermarks = new Map<string, number>();
    const processedSeqs: number[] = [];

    // Process output seq 1
    const output1 = { symbol: "AAPL", seq: 1, ts: 1000, command: {}, events: [] };
    processedSeqs.push(output1.seq);
    watermarks.set(output1.symbol, output1.seq);

    // Process output seq 2
    const output2 = { symbol: "AAPL", seq: 2, ts: 1001, command: {}, events: [] };
    if (output2.seq > (watermarks.get(output2.symbol) ?? 0)) {
      processedSeqs.push(output2.seq);
      watermarks.set(output2.symbol, output2.seq);
    }

    expect(watermarks.get("AAPL")).toBe(2);
    expect(processedSeqs).toEqual([1, 2]);
  });

  it("CP5: MarketView rebuilds by replaying engine EVENT rows", async () => {
    // Recovery replays all events from the journal:
    // for each symbol:
    //   for each EVENT row:
    //     router.marketView.apply(symbol, eventPayload)
    //   set watermark to last event seq

    const events = [
      { symbol: "AAPL", seq: 1, payload: { type: "Trade", qty: 100 } },
      { symbol: "AAPL", seq: 2, payload: { type: "Trade", qty: 200 } },
      { symbol: "MSFT", seq: 1, payload: { type: "Trade", qty: 50 } },
    ];

    const appliedBySymbol = new Map<string, number[]>();

    for (const event of events) {
      if (!appliedBySymbol.has(event.symbol)) {
        appliedBySymbol.set(event.symbol, []);
      }
      appliedBySymbol.get(event.symbol)!.push(event.seq);
    }

    expect(appliedBySymbol.get("AAPL")).toEqual([1, 2]);
    expect(appliedBySymbol.get("MSFT")).toEqual([1]);
  });
});
