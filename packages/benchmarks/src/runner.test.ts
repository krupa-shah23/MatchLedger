import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { EnvironmentBlock } from "./env-block.js";
import type { BenchmarkDriver } from "./runner.js";
import { runBenchmark } from "./runner.js";
import type { BenchmarkMetrics } from "./results-schema.js";

const environment: EnvironmentBlock = {
  cpuModel: "Synthetic CPU",
  logicalCores: 1,
  ramBytes: 1024,
  os: "test-os",
  kernel: "test-kernel",
  nodeVersion: "v24.0.0",
  dockerServerVersion: "test-docker",
  containerLimits: { cpuCores: null, memoryBytes: null },
  gitShortSha: "fixture-sha",
  dirty: false,
  dirtyAllowed: false,
};

const completeMetrics: BenchmarkMetrics = {
  sent: 2,
  accepted: 1,
  rejected: 1,
  dropped_iterations: 0,
  acceptedOrdersPerSecond: 1,
  latencyMs: { p50: 1, p95: 1, p99: 1 },
  eventLoopDelayMs: { p99: 1, max: 1 },
  gcPauseTotalMs: 0,
  queueDepthMax: 0,
  fullCount: 0,
  consumerLagMax: 0,
  rejectionCountsByReason: {},
  errors: { total: 0, byCode: {} },
};

describe("LG7: benchmark runner validity", () => {
  it("LG7: runs reset, warmup, measurement and collection for each repetition, then writes the result JSON", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "matchledger-runner-"));
    const events: string[] = [];
    const driver: BenchmarkDriver = {
      async resetState({ repetition }) { events.push(`reset:${repetition}`); },
      async runWindow(phase, durationMs) { events.push(`${phase}:${durationMs}`); },
      async collectMetrics() { events.push("collect"); return completeMetrics; },
    };
    try {
      const output = await runBenchmark({
        experiment: "lg7-fixture",
        config: { warmupMs: 5, measureMs: 10, repetitions: 1 },
        driver,
        resultsRoot: directory,
        environment: async () => environment,
        now: () => new Date("2026-10-31T00:00:00.000Z"),
      });
      expect(events).toEqual(["reset:1", "warmup:5", "measure:10", "collect"]);
      expect(output.result.valid).toBe(true);
      expect(JSON.parse(await readFile(output.path, "utf8"))).toEqual(output.result);
      expect(output.path).toContain("lg7-fixture");
      expect(output.path.endsWith("2026-10-31T00-00-00.000Z-fixture-sha.json")).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("LG7: marks dropped iterations and count mismatches invalid while still writing results", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "matchledger-invalid-run-"));
    const invalidMetrics = [
      { ...completeMetrics, dropped_iterations: 1 },
      { ...completeMetrics, accepted: 0 },
    ];
    let nextMetrics = 0;
    const driver: BenchmarkDriver = {
      async resetState() {},
      async runWindow() {},
      async collectMetrics() { return invalidMetrics[nextMetrics++]!; },
    };
    try {
      const output = await runBenchmark({
        experiment: "lg7-invalid-fixture",
        config: { warmupMs: 5, measureMs: 10, repetitions: 2 },
        driver,
        resultsRoot: directory,
        environment: async () => environment,
        now: () => new Date("2026-10-31T00:00:01.000Z"),
      });
      expect(output.result.valid).toBe(false);
      expect(output.result.repetitions.map((repetition) => repetition.valid)).toEqual([false, false]);
      expect(output.result.invalidReasons).toHaveLength(2);
      expect(output.result.repetitions[0]!.invalidReasons).toContain("dropped_iterations must be zero");
      expect(output.result.repetitions[1]!.invalidReasons).toContain("accepted plus rejected must equal sent");
      expect(JSON.parse(await readFile(output.path, "utf8")).valid).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
