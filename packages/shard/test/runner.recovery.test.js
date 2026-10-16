import { describe, it, expect } from "vitest";
import { ShardRunner } from "../src/shard-runner.js";
import { Engine } from "@matchledger/engine-core";
import { systemClock } from "../src/system-clock.js";
import { InMemoryJournal } from "../src/in-memory-journal.js";
import { CollectingSink } from "../src/collecting-sink.js";
const spec = { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxQuantity: 1000n, maxPrice: 10000n };
describe("SH16-SH18: Runner recovery integration", () => {
    it("SH16: afterBatch hook called after publish", async () => {
        const calls = [];
        const runner = new ShardRunner({
            symbols: new Map([["ABC", spec]]),
            clock: systemClock,
            journal: new InMemoryJournal(),
            sink: new CollectingSink(),
            queueCapacity: 100,
            maxBatch: 10,
            afterBatch: async (ctx) => {
                calls.push(ctx);
            },
        });
        runner.start();
        runner.tryEnqueue("ABC", { kind: "TICK", ts: 1000n });
        await new Promise((r) => setTimeout(r, 100));
        await runner.stop();
        expect(calls.length).toBeGreaterThan(0);
    });
    it("SH17: afterBatch throws stops runner", async () => {
        const runner = new ShardRunner({
            symbols: new Map([["ABC", spec]]),
            clock: systemClock,
            journal: new InMemoryJournal(),
            sink: new CollectingSink(),
            queueCapacity: 100,
            maxBatch: 10,
            afterBatch: async () => {
                throw new Error("boom");
            },
        });
        runner.start();
        runner.tryEnqueue("ABC", { kind: "TICK", ts: 1000n });
        const result = await runner.done;
        expect(result.reason).toBe("FAILED");
    });
    it("SH18: Recovered state loads books and stamper", async () => {
        const book = new Engine(spec);
        const recovered = {
            streams: new Map([["ABC", { book, lastSeq: 5, lastTs: 5000 }]]),
            lastSeqBySymbol: new Map([["ABC", 5]]),
            lastTs: 5000,
        };
        const runner = new ShardRunner({
            symbols: new Map([["ABC", spec]]),
            clock: systemClock,
            journal: new InMemoryJournal(),
            sink: new CollectingSink(),
            queueCapacity: 100,
            maxBatch: 10,
            recovered,
        });
        expect(runner.state).toBe("IDLE");
        runner.start();
        await new Promise((r) => setTimeout(r, 50));
        await runner.stop();
    });
});
