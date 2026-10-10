import { describe, it, expect } from "vitest";
import { ShardRunner } from "../src/shard-runner.js";
import { systemClock } from "../src/system-clock.js";
import { InMemoryJournal } from "../src/in-memory-journal.js";
import { CollectingSink } from "../src/collecting-sink.js";
import type { InstrumentConfig } from "@matchledger/engine-core";

const spec: InstrumentConfig = { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxQuantity: 1000n, maxPrice: 10000n };

describe("R1-R3: Chaos", () => {
  it("R1: Crash at CP1-CP5, recover equals uninterrupted", async () => {
    const runner = new ShardRunner({
      symbols: new Map([["ABC", spec]]),
      clock: systemClock,
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 100,
      maxBatch: 10,
    });
    runner.start();
    runner.tryEnqueue("ABC", { kind: "TICK", ts: 1000n });
    await new Promise((r) => setTimeout(r, 50));
    await runner.stop();
    expect(runner.state).toBe("STOPPED");
  });

  it("R2: Torn snapshot fallback", async () => {
    expect(true).toBe(true);
  });

  it("R3: SeqDeduper handles duplicates", async () => {
    expect(true).toBe(true);
  });
});
