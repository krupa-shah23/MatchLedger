import { z } from "zod";

const finiteNonNegative = z.number().finite().nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();

export const EnvironmentBlockSchema = z.object({
  cpuModel: z.string().min(1),
  logicalCores: z.number().int().positive(),
  ramBytes: finiteNonNegative,
  os: z.string().min(1),
  kernel: z.string().min(1),
  nodeVersion: z.string().min(1),
  dockerServerVersion: z.string().min(1),
  containerLimits: z.object({
    cpuCores: finiteNonNegative.nullable(),
    memoryBytes: finiteNonNegative.nullable(),
  }),
  gitShortSha: z.string().min(1),
  dirty: z.boolean(),
  dirtyAllowed: z.boolean(),
});

export const BenchmarkMetricsSchema = z.object({
  sent: nonNegativeInteger,
  accepted: nonNegativeInteger,
  rejected: nonNegativeInteger,
  dropped_iterations: nonNegativeInteger,
  acceptedOrdersPerSecond: finiteNonNegative,
  latencyMs: z.object({
    p50: finiteNonNegative,
    p95: finiteNonNegative,
    p99: finiteNonNegative,
  }),
  eventLoopDelayMs: z.object({
    p99: finiteNonNegative,
    max: finiteNonNegative,
  }),
  gcPauseTotalMs: finiteNonNegative,
  queueDepthMax: nonNegativeInteger,
  fullCount: nonNegativeInteger,
  consumerLagMax: nonNegativeInteger,
  rejectionCountsByReason: z.record(z.string(), nonNegativeInteger),
  errors: z.object({
    total: nonNegativeInteger,
    byCode: z.record(z.string(), nonNegativeInteger),
  }),
});

export const BenchmarkRepetitionSchema = z.object({
  index: z.number().int().positive(),
  measuredAt: z.iso.datetime(),
  metrics: BenchmarkMetricsSchema,
  valid: z.boolean(),
  invalidReasons: z.array(z.string()),
});

export const BenchmarkConfigSchema = z.object({
  warmupMs: z.number().int().positive(),
  measureMs: z.number().int().positive(),
  repetitions: z.number().int().positive(),
  seed: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
});

export const BenchmarkResultSchema = z.object({
  schemaVersion: z.literal(1),
  experiment: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  runAt: z.iso.datetime(),
  config: BenchmarkConfigSchema,
  environment: EnvironmentBlockSchema,
  repetitions: z.array(BenchmarkRepetitionSchema),
  valid: z.boolean(),
  invalidReasons: z.array(z.string()),
}).superRefine((result, context) => {
  if (result.repetitions.length !== result.config.repetitions) {
    context.addIssue({
      code: "custom",
      path: ["repetitions"],
      message: "repetition count must match config.repetitions",
    });
  }
  const allValid = result.repetitions.every((repetition) => repetition.valid);
  if (result.valid !== allValid) {
    context.addIssue({
      code: "custom",
      path: ["valid"],
      message: "run validity must match all repetition validity flags",
    });
  }
});

export type BenchmarkMetrics = z.infer<typeof BenchmarkMetricsSchema>;
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;
export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>;
