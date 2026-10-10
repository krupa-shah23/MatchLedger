import { describe, expect, it, vi } from "vitest";
import { CollectingSink, InMemoryJournal, ShardRunner, yieldToEventLoop } from "../src/index.js";
import { ACME, BETA, FakeClock, place } from "./helpers.js";

type RunnerOverrides = Omit<Partial<ConstructorParameters<typeof ShardRunner>[0]>, "journal" | "sink"> & {
  journal?: InMemoryJournal;
  sink?: CollectingSink;
};

function makeRunner(overrides: RunnerOverrides = {}): {
  runner: ShardRunner;
  journal: InMemoryJournal;
  sink: CollectingSink;
} {
  const journal = overrides.journal ?? new InMemoryJournal();
  const sink = overrides.sink ?? new CollectingSink();
  const runner = new ShardRunner({
    symbols: new Map([["ACME", ACME], ["BETA", BETA]]),
    clock: overrides.clock ?? new FakeClock([1000]),
    journal,
    sink,
    queueCapacity: overrides.queueCapacity ?? 100,
    maxBatch: overrides.maxBatch ?? 2,
    yieldFn: overrides.yieldFn ?? (() => Promise.resolve()),
    onFatal: overrides.onFatal,
    bookFactory: overrides.bookFactory,
  });
  return { runner, journal, sink };
}

function commandId(command: ReturnType<typeof place>): string {
  return command.kind === "TICK" ? "TICK" : command.orderId;
}

describe.skipIf((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RUN_WEEK4 !== "1")("ShardRunner", () => {
  it("SH1 stamps clamped timestamps and per-symbol sequences", async () => {
    const { runner, journal, sink } = makeRunner({ clock: new FakeClock([1000, 1000, 990, 1005]) });
    runner.tryEnqueue("ACME", place("a1"));
    runner.tryEnqueue("BETA", place("b1", "BUY", 100n, 10n));
    runner.tryEnqueue("ACME", place("a2"));
    runner.tryEnqueue("ACME", place("a3"));
    runner.start();
    await runner.stop();
    expect(journal.all().map((item) => [item.symbol, item.seq, item.ts])).toEqual([
      ["ACME", 1, 1000], ["BETA", 1, 1000], ["ACME", 2, 1000], ["ACME", 3, 1005],
    ]);
    expect(sink.all().map((item) => item.ts)).toEqual([1000, 1000, 1000, 1005]);
  });

  it("SH2 overwrites the command timestamp", async () => {
    const { runner, journal } = makeRunner();
    runner.tryEnqueue("ACME", { ...place("a1"), ts: 12345n });
    runner.start();
    await runner.stop();
    expect(journal.all()[0]?.command.ts).toBe(1000n);
  });

  it("SH3 does not apply before the journal resolves", async () => {
    const journal = new InMemoryJournal();
    journal.hold();
    let applied = 0;
    const { runner, sink } = makeRunner({
      journal,
      bookFactory: () => ({ apply: () => { applied += 1; return []; } }),
    });
    runner.tryEnqueue("ACME", place("a1"));
    runner.tryEnqueue("ACME", place("a2"));
    runner.tryEnqueue("ACME", place("a3"));
    runner.start();
    await yieldToEventLoop();
    expect(applied).toBe(0);
    expect(sink.all()).toEqual([]);
    journal.release();
    await runner.stop();
    expect(applied).toBe(3);
  });

  it("SH4 and SH5 preserve enqueue order across symbols", async () => {
    const calls: string[] = [];
    const { runner, journal, sink } = makeRunner({
      maxBatch: 3,
      bookFactory: (symbol) => ({ apply: (command) => { calls.push(`${symbol}:${commandId(command)}`); return []; } }),
    });
    for (let index = 0; index < 7; index += 1) {
      runner.tryEnqueue(index % 2 === 0 ? "ACME" : "BETA", place(`o${index}`, "BUY", index % 2 === 0 ? 100n : 100n, index % 2 === 0 ? 1n : 10n));
    }
    runner.start();
    await runner.stop();
    expect(journal.all().map((item) => item.seq)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    expect(journal.all().map((item) => commandId(item.command))).toEqual(sink.all().map((item) => commandId(item.command)));
    expect(calls).toEqual(["ACME:o0", "BETA:o1", "ACME:o2", "BETA:o3", "ACME:o4", "BETA:o5", "ACME:o6"]);
  });

  it("SH6 rejects unknown symbols before stamping", () => {
    const { runner, journal } = makeRunner();
    expect(runner.tryEnqueue("NOPE", place("x"))).toBe("UNKNOWN_SYMBOL");
    expect(journal.all()).toEqual([]);
    expect(runner.tryEnqueue("ACME", place("a"))).toBe("ACCEPTED");
  });

  it("SH7 yields between batches", async () => {
    const yields: number[] = [];
    let outputCount = 0;
    const { runner, sink } = makeRunner({
      queueCapacity: 10_000,
      maxBatch: 100,
      yieldFn: async () => { yields.push(outputCount); await Promise.resolve(); },
    });
    for (let index = 0; index < 10_000; index += 1) runner.tryEnqueue("ACME", place(`o${index}`));
    const original = sink.publish.bind(sink);
    sink.publish = async (batch) => { await original(batch); outputCount += batch.length; };
    runner.start();
    await runner.stop();
    expect(yields.length).toBeGreaterThan(0);
  });

  it("SH8 reports queue backpressure", () => {
    const journal = new InMemoryJournal();
    journal.hold();
    const { runner } = makeRunner({ journal, queueCapacity: 8, maxBatch: 1 });
    const results = Array.from({ length: 13 }, (_, index) => runner.tryEnqueue("ACME", place(`o${index}`)));
    expect(results.filter((result) => result === "FULL").length).toBeGreaterThan(0);
  });

  it("SH9 and SH10 route journal and sink errors to FAILED", async () => {
    const error = new Error("failure");
    const onFatal = vi.fn();
    const journal = new InMemoryJournal();
    journal.failNext(error);
    const first = makeRunner({ journal, onFatal });
    first.runner.tryEnqueue("ACME", place("a"));
    first.runner.start();
    await expect(first.runner.done).resolves.toEqual({ reason: "FAILED", error });
    expect(onFatal).toHaveBeenCalledTimes(1);
    const sink = new CollectingSink();
    sink.failNext(error);
    const second = makeRunner({ sink, onFatal });
    second.runner.tryEnqueue("ACME", place("a"));
    second.runner.start();
    await expect(second.runner.done).resolves.toEqual({ reason: "FAILED", error });
  });

  it("SH11 drains on stop and SH12 discards queued work after the in-flight batch", async () => {
    const { runner, journal, sink } = makeRunner({ maxBatch: 7 });
    for (let index = 0; index < 50; index += 1) runner.tryEnqueue("ACME", place(`o${index}`));
    runner.start();
    await runner.stop({ drain: true });
    expect(journal.all()).toHaveLength(50);
    expect(sink.all()).toHaveLength(50);
    expect(runner.state).toBe("STOPPED");
    await runner.stop();
    expect(runner.tryEnqueue("ACME", place("late"))).toBe("CLOSED");
  });

  it("SH12 keeps the in-flight batch and discards the remaining queue", async () => {
    const journal = new InMemoryJournal();
    journal.hold();
    const { runner } = makeRunner({ journal, maxBatch: 2, queueCapacity: 10 });
    for (let index = 0; index < 5; index += 1) runner.tryEnqueue("ACME", place(`o${index}`));
    runner.start();
    await yieldToEventLoop();
    const stopping = runner.stop({ drain: false });
    journal.release();
    await stopping;
    expect(runner.discarded).toBe(3);
    expect(runner.state).toBe("STOPPED");
  });

  it("SH13 preserves order while the sink is held", async () => {
    const sink = new CollectingSink();
    sink.hold();
    const { runner } = makeRunner({ sink });
    runner.tryEnqueue("ACME", place("a"));
    runner.tryEnqueue("ACME", place("b"));
    runner.start();
    await yieldToEventLoop();
    sink.release();
    await runner.stop();
    expect(sink.all().map((item) => commandId(item.command))).toEqual(["a", "b"]);
  });

  it("SH14 and SH15 fail without applying the failing batch or later commands", async () => {
    const onFatal = vi.fn();
    const { runner, journal } = makeRunner({ clock: new FakeClock([1000, Number.NaN]), onFatal });
    runner.tryEnqueue("ACME", place("a"));
    runner.tryEnqueue("ACME", place("b"));
    runner.start();
    await expect(runner.done).resolves.toMatchObject({ reason: "FAILED" });
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(journal.all()).toHaveLength(0);
  });

  it("SH15 routes an engine error to FAILED", async () => {
    const onFatal = vi.fn();
    let calls = 0;
    const { runner } = makeRunner({
      onFatal,
      bookFactory: () => ({
        apply: () => {
          calls += 1;
          if (calls === 2) throw new Error("engine failure");
          return [];
        },
      }),
    });
    runner.tryEnqueue("ACME", place("a"));
    runner.tryEnqueue("ACME", place("b"));
    runner.start();
    await expect(runner.done).resolves.toMatchObject({ reason: "FAILED" });
    expect(onFatal).toHaveBeenCalledTimes(1);
  });

  it("validates lifecycle operations", async () => {
    expect(() => makeRunner({ queueCapacity: 0 })).toThrow(RangeError);
    expect(() => makeRunner({ maxBatch: 0 })).toThrow(RangeError);
    const { runner } = makeRunner();
    await runner.stop();
    expect(runner.state).toBe("STOPPED");
    expect(() => runner.start()).toThrow();
  });
});
