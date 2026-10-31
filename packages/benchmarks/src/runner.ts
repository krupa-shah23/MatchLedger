import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EnvironmentBlock } from "./env-block.js";
import { captureEnvironmentBlock } from "./env-block.js";
import { findRepositoryRoot } from "./repo-root.js";
import {
  BenchmarkConfigSchema,
  BenchmarkMetricsSchema,
  BenchmarkResultSchema,
  type BenchmarkConfig,
  type BenchmarkMetrics,
  type BenchmarkResult,
} from "./results-schema.js";

export interface BenchmarkDriver {
  resetState(context: { experiment: string; repetition: number }): Promise<void>;
  runWindow(phase: "warmup" | "measure", durationMs: number): Promise<void>;
  collectMetrics(): Promise<BenchmarkMetrics>;
}

export interface BenchmarkRunnerOptions {
  readonly experiment: string;
  readonly config: BenchmarkConfig;
  readonly driver: BenchmarkDriver;
  readonly cwd?: string;
  readonly resultsRoot?: string;
  readonly argv?: readonly string[];
  readonly now?: () => Date;
  readonly environment?: () => Promise<EnvironmentBlock>;
}

export interface BenchmarkRunOutput {
  readonly result: BenchmarkResult;
  readonly path: string;
}

function repetitionValidity(metrics: BenchmarkMetrics): string[] {
  const reasons: string[] = [];
  if (metrics.dropped_iterations > 0) {
    reasons.push("dropped_iterations must be zero");
  }
  if (metrics.accepted + metrics.rejected !== metrics.sent) {
    reasons.push("accepted plus rejected must equal sent");
  }
  return reasons;
}

function filenameTimestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-");
}

export async function runBenchmark(options: BenchmarkRunnerOptions): Promise<BenchmarkRunOutput> {
  const config = BenchmarkConfigSchema.parse(options.config);
  const cwd = resolve(options.cwd ?? await findRepositoryRoot());
  const experiment = options.experiment;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(experiment)) {
    throw new Error("experiment must be a lowercase slug");
  }
  const now = options.now ?? (() => new Date());
  const environmentProvider = options.environment
    ?? (() => captureEnvironmentBlock({ cwd, argv: options.argv }));
  const environment = await environmentProvider();
  const startedAt = now();
  const repetitions: BenchmarkResult["repetitions"] = [];

  for (let index = 1; index <= config.repetitions; index += 1) {
    await options.driver.resetState({ experiment, repetition: index });
    await options.driver.runWindow("warmup", config.warmupMs);
    await options.driver.runWindow("measure", config.measureMs);
    const metrics = BenchmarkMetricsSchema.parse(await options.driver.collectMetrics());
    const invalidReasons = repetitionValidity(metrics);
    repetitions.push({
      index,
      measuredAt: now().toISOString(),
      metrics,
      valid: invalidReasons.length === 0,
      invalidReasons,
    });
  }

  const result = BenchmarkResultSchema.parse({
    schemaVersion: 1,
    experiment,
    runAt: startedAt.toISOString(),
    config,
    environment,
    repetitions,
    valid: repetitions.every((repetition) => repetition.valid),
    invalidReasons: repetitions.flatMap((repetition) =>
      repetition.invalidReasons.map((reason) => `repetition ${repetition.index}: ${reason}`)),
  });

  const resultDirectory = resolve(options.resultsRoot ?? resolve(cwd, "packages/benchmarks/results"), experiment);
  await mkdir(resultDirectory, { recursive: true });
  const path = resolve(resultDirectory, `${filenameTimestamp(startedAt)}-${environment.gitShortSha}.json`);
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return { result, path };
}
