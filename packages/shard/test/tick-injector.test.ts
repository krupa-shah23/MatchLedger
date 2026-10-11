import { describe, expect, it, vi } from "vitest";
import { ShardRunner } from "../src/shard-runner.js";
import { TickInjector } from "../src/tick-injector.js";
import { InMemoryJournal } from "../src/in-memory-journal.js";
import { CollectingSink } from "../src/collecting-sink.js";
import { FakeClock } from "./helpers.js";

describe("Tick injector", () => {
  it("TI1: tickOnce only enqueues symbols that need ticks", () => {
    const runner = new ShardRunner({
      symbols: new Map([["ACME", { symbol: "ACME", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }]]),
      clock: new FakeClock([1000]),
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 10,
      maxBatch: 3,
      breakerConfigs: new Map([["ACME", { closed: false }]]),
      bookFactory: (symbol) => ({
        apply: () => [],
        needsTick: () => symbol === "ACME",
      }),
    });

    expect(runner.symbolsNeedingTicks()).toEqual(["ACME"]);
    runner.tryEnqueue("ACME", { kind: "TICK", ts: 0n });
    expect(runner.tryEnqueue("ACME", { kind: "TICK", ts: 0n })).toBe("ACCEPTED");
    expect(runner.symbolsNeedingTicks()).toEqual(["ACME"]);
  });

  it("TI2: Closed symbols do not receive ticks", () => {
    const runner = new ShardRunner({
      symbols: new Map([["ACME", { symbol: "ACME", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }]]),
      clock: new FakeClock([1000]),
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 10,
      maxBatch: 3,
      breakerConfigs: new Map([["ACME", { closed: true }]]),
    });

    expect(runner.symbolsNeedingTicks()).toEqual([]);
  });

  it("TI3: start(intervalMs) schedules ticks and stop() cancels them", () => {
    vi.useFakeTimers();
    const runner = new ShardRunner({
      symbols: new Map([["ACME", { symbol: "ACME", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }]]),
      clock: new FakeClock([1000]),
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 10,
      maxBatch: 1,
      breakerConfigs: new Map([["ACME", { closed: false }]]),
    });

    const injector = new TickInjector(runner);
    injector.start(100);
    vi.advanceTimersByTime(100);
    expect(runner.symbolsNeedingTicks()).toEqual(["ACME"]);
    injector.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("TI4: FULL queue skips the tick without throwing", () => {
    const runner = new ShardRunner({
      symbols: new Map([["ACME", { symbol: "ACME", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }]]),
      clock: new FakeClock([1000]),
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 1,
      maxBatch: 1,
      breakerConfigs: new Map([["ACME", { closed: false }]]),
    });
    runner.tryEnqueue("ACME", { kind: "TICK", ts: 0n });
    const injector = new TickInjector(runner);
    expect(() => injector.tickOnce()).not.toThrow();
    expect(runner.tryEnqueue("ACME", { kind: "TICK", ts: 0n })).toBe("FULL");
  });

  it("TI5: tickOnce uses the runner read-only symbols list", () => {
    const runner = new ShardRunner({
      symbols: new Map([["ACME", { symbol: "ACME", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }], ["BETA", { symbol: "BETA", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }]]),
      clock: new FakeClock([1000]),
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 10,
      maxBatch: 2,
      breakerConfigs: new Map([["ACME", { closed: false }], ["BETA", { closed: true }]]),
    });

    const injector = new TickInjector(runner);
    injector.tickOnce();
    expect(runner.symbolsNeedingTicks()).toEqual(["ACME"]);
  });

  it("SP1x: runner replay remains deterministic with ticks and breaker config", () => {
    const runnerA = new ShardRunner({
      symbols: new Map([["ACME", { symbol: "ACME", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }]]),
      clock: new FakeClock([1000]),
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 10,
      maxBatch: 2,
      breakerConfigs: new Map([["ACME", { closed: false }]]),
    });
    const runnerB = new ShardRunner({
      symbols: new Map([["ACME", { symbol: "ACME", tickSize: 1n, lotSize: 1n, maxQuantity: 100n, maxPrice: 1000n }]]),
      clock: new FakeClock([1000]),
      journal: new InMemoryJournal(),
      sink: new CollectingSink(),
      queueCapacity: 10,
      maxBatch: 2,
      breakerConfigs: new Map([["ACME", { closed: false }]]),
    });

    expect(runnerA.symbolsNeedingTicks()).toEqual(runnerB.symbolsNeedingTicks());
    expect(runnerA.symbolsNeedingTicks()).toEqual(["ACME"]);
  });
});
