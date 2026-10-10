import { cpus, totalmem } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { Bench } from "tinybench";
import { Engine } from "@matchledger/engine-core";
import type { InstrumentConfig, Command } from "@matchledger/engine-core";
import { BoundedQueue } from "@matchledger/common";
import { Stamper } from "@matchledger/shard";

const config: InstrumentConfig = {
  symbol: "BENCH",
  tickSize: 1n,
  lotSize: 1n,
  maxQuantity: 1_000_000n,
  maxPrice: 1_000_000n,
};

const place = (orderId: string, side: "BUY" | "SELL", price: bigint, quantity = 1n, timeInForce: "GTC" | "IOC" = "GTC") => ({
  kind: "PLACE" as const,
  ts: 1n,
  orderId,
  accountId: "benchmark-account",
  side,
  orderType: "LIMIT" as const,
  timeInForce,
  price,
  quantity,
});

const cancel = (orderId: string): Command => ({ kind: "CANCEL", ts: 2n, orderId });

const seedLevels = (count: number, side: "BUY" | "SELL"): Engine => {
  const engine = new Engine(config);
  for (let index = 0; index < count; index += 1) {
    const price = side === "SELL" ? BigInt(100 + index) : BigInt(100 - index);
    engine.apply(place(`level-${side}-${index}`, side, price));
  }
  return engine;
};

const seedLevel = (count: number): Engine => {
  const engine = new Engine(config);
  for (let index = 0; index < count; index += 1) {
    engine.apply(place(`level-${index}`, "SELL", 100n));
  }
  return engine;
};

const bench = new Bench({ time: 100, warmupTime: 100, throws: false });

bench.add("B1 rest new best level then cancel", () => {
  engine.apply(place("b1", "BUY", 101n));
  engine.apply(cancel("b1"));
}, { beforeEach: () => { engine = seedLevels(10, "BUY"); engine.apply(place("ask-seed", "SELL", 200n)); } });

bench.add("B2 rest at existing level then cancel", () => {
  engine.apply(place("b2", "BUY", 100n));
  engine.apply(cancel("b2"));
}, { beforeEach: () => { engine = seedLevels(10, "BUY"); } });

bench.add("B3 match one taker against one maker", () => {
  engine.apply(place("taker", "BUY", 100n));
}, { beforeEach: () => { engine = new Engine(config); engine.apply(place("maker", "SELL", 100n)); } });

bench.add("B4 sweep three levels", () => {
  engine.apply(place("taker", "BUY", 103n, 3n));
}, { beforeEach: () => {
  engine = new Engine(config);
  engine.apply(place("maker-101", "SELL", 101n));
  engine.apply(place("maker-102", "SELL", 102n));
  engine.apply(place("maker-103", "SELL", 103n));
} });

for (const [name, victim] of [["B5 cancel head", "level-0"], ["B5 cancel middle", "level-50"], ["B5 cancel tail", "level-99"]] as const) {
  bench.add(name, () => {
    engine.apply(cancel(victim));
  }, { beforeEach: () => { engine = seedLevel(100); } });
}

bench.add("B6 IOC with no liquidity", () => {
  engine.apply(place("ioc", "BUY", 100n, 1n, "IOC"));
}, { beforeEach: () => { engine = new Engine(config); } });

for (const count of [10, 100, 1_000]) {
  bench.add(`B7 insert worst level (${count} live levels)`, () => {
    engine.apply(place("worst", "SELL", 100n + BigInt(count)));
    engine.apply(cancel("worst"));
  }, { beforeEach: () => { engine = seedLevels(count, "SELL"); } });
}

let engine = new Engine(config);

interface BenchMetrics {
  readonly state: "completed";
  readonly latency: { readonly mean: number; readonly rme: number; readonly samplesCount: number };
  readonly throughput: { readonly mean: number };
}

const hasMetrics = (value: unknown): value is BenchMetrics => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const latency = candidate["latency"];
  const throughput = candidate["throughput"];
  return candidate["state"] === "completed"
    && typeof latency === "object" && latency !== null
    && typeof throughput === "object" && throughput !== null
    && typeof (latency as { mean?: unknown }).mean === "number"
    && typeof (latency as { rme?: unknown }).rme === "number"
    && typeof (latency as { samplesCount?: unknown }).samplesCount === "number"
    && typeof (throughput as { mean?: unknown }).mean === "number";
};

const benchClock = { now: () => 1_000 } as const;
let stamper = new Stamper(benchClock);
let queue = new BoundedQueue<Command>(1024);
let queueOrder = 0;
const week4Bench = new Bench({ time: 100, warmupTime: 100 });

week4Bench.add("B8 Stamper.stamp", () => {
  const symbol = queueOrder % 2 === 0 ? "ACME" : "BETA";
  stamper.stamp(symbol, place(`stamp-${queueOrder}`, "BUY", 100n));
  queueOrder += 1;
}, {
  beforeEach: () => {
    stamper = new Stamper(benchClock);
    queueOrder = 0;
  },
});

week4Bench.add("B9 BoundedQueue.tryEnqueue followed by drainSync(1)", () => {
  if (!queue.tryEnqueue(place("queue-item", "BUY", 100n))) {
    throw new Error("B9 queue unexpectedly full");
  }
  queue.drainSync(1);
}, {
  beforeEach: () => {
    queue = new BoundedQueue<Command>(1024);
  },
});

await week4Bench.run();
const week4Table = week4Bench.tasks.map((task) => {
  const result = task.result;
  if (!hasMetrics(result)) throw new Error(`benchmark ${task.name} did not complete`);
  return {
    name: task.name,
    status: "complete",
    opsPerSec: result.throughput.mean,
    meanLatencyNs: result.latency.mean * 1_000_000,
    relativeMarginOfError: result.latency.rme,
    samples: result.latency.samplesCount,
  };
});

await bench.run();

const environment = {
  node: process.version,
  os: `${process.platform} ${process.release.name}`,
  cpu: cpus()[0]?.model ?? "unknown",
  cpuCount: cpus().length,
  totalMemoryBytes: totalmem(),
  date: new Date().toISOString(),
};

const table = bench.tasks.map((task) => {
  const result = task.result;
  const completed = hasMetrics(result);
  if (!completed) {
    return {
      name: task.name,
      status: "blocked",
      error: String(result && "error" in result ? result.error : "no result"),
    };
  }
  return {
    name: task.name,
    status: "complete",
    opsPerSec: result.throughput.mean,
    meanLatencyNs: result.latency.mean * 1_000_000,
    relativeMarginOfError: result.latency.rme,
    samples: result.latency.samplesCount,
  };
});

console.log(environment);
console.table(table);
console.table(week4Table);
await mkdir("packages/benchmarks/results", { recursive: true });
await writeFile("packages/benchmarks/results/latest.json", JSON.stringify({ environment, benchmarks: [...table, ...week4Table] }, null, 2));
