import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CollectingSink, InMemoryJournal, ShardRunner } from "../src/index.js";
import type { Command } from "@matchledger/engine-core";
import { ACME, BETA, FakeClock, place } from "./helpers.js";

const commandArbitrary = fc.oneof(
  fc.integer({ min: 0, max: 99 }).map((index): Command => place(`o${index}`, "BUY", 100n, 1n)),
  fc.integer({ min: 0, max: 99 }).map((index): Command => place(`b${index}`, "BUY", 100n, 10n)),
);

describe.skipIf((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RUN_WEEK4 !== "1")("ShardRunner properties", () => {
  it("SP1 matches synchronous replay after journaling", async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(commandArbitrary, { minLength: 1, maxLength: 100 }),
      fc.integer({ min: 1, max: 20 }),
      fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 100 }),
      fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 100 }),
      async (commands, maxBatch, journalDelays, sinkDelays) => {
        const journal = new InMemoryJournal(journalDelays);
        const sink = new CollectingSink(sinkDelays);
        const runner = new ShardRunner({
          symbols: new Map([["ACME", ACME], ["BETA", BETA]]),
          clock: new FakeClock([1000]),
          journal,
          sink,
          queueCapacity: commands.length + 1,
          maxBatch,
          yieldFn: () => Promise.resolve(),
        });
        for (const command of commands) expect(runner.tryEnqueue("ACME", command)).toBe("ACCEPTED");
        runner.start();
        await runner.stop({ drain: true });
        expect(runner.state).toBe("STOPPED");
        expect(sink.all().map((output) => output.command.kind)).toEqual(journal.all().map((item) => item.command.kind));
      },
    ), { numRuns: 500 });
  });

  it("SP2 preserves non-decreasing timestamps and contiguous symbol sequences", async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.integer({ min: 0, max: 2_000 }), { minLength: 1, maxLength: 50 }),
      fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }),
      fc.integer({ min: 1, max: 20 }),
      async (readings, symbols, maxBatch) => {
        const journal = new InMemoryJournal();
        const runner = new ShardRunner({
          symbols: new Map([["ACME", ACME], ["BETA", BETA]]),
          clock: new FakeClock(readings),
          journal,
          sink: new CollectingSink(),
          queueCapacity: 100,
          maxBatch,
          yieldFn: () => Promise.resolve(),
        });
        const count = Math.min(readings.length, symbols.length);
        for (let index = 0; index < count; index += 1) {
          const symbol = symbols[index] === true ? "ACME" : "BETA";
          expect(runner.tryEnqueue(symbol, symbol === "ACME" ? place(`a${index}`) : place(`b${index}`, "BUY", 100n, 10n))).toBe("ACCEPTED");
        }
        runner.start();
        await runner.stop({ drain: true });
        const stamped = journal.all();
        expect(stamped.map((item) => item.ts)).toEqual([...stamped.map((item) => item.ts)].sort((left, right) => left - right));
        for (const symbol of ["ACME", "BETA"]) {
          expect(stamped.filter((item) => item.symbol === symbol).map((item) => item.seq)).toEqual(
            stamped.filter((item) => item.symbol === symbol).map((_, index) => index + 1),
          );
        }
      },
    ), { numRuns: 1000 });
  });
});
