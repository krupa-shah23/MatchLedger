import { describe, expect, it } from "vitest";
import { BenchmarkResultSchema } from "./results-schema.js";
import { validBenchmarkFixture as validResult } from "./benchmark-fixture.js";

describe("LG2: benchmark result schema", () => {
  it("LG2: accepts a complete result and rejects missing fields, negative values, and wrong types", () => {
    expect(BenchmarkResultSchema.parse(validResult).experiment).toBe("fixture-run");

    const { environment: _environment, ...missingEnvironment } = validResult;
    expect(BenchmarkResultSchema.safeParse(missingEnvironment).success).toBe(false);

    const negativeMetrics = {
      ...validResult,
      repetitions: [{
        ...validResult.repetitions[0]!,
        metrics: { ...validResult.repetitions[0]!.metrics, acceptedOrdersPerSecond: -1 },
      }],
    };
    expect(BenchmarkResultSchema.safeParse(negativeMetrics).success).toBe(false);

    const wrongType = {
      ...validResult,
      repetitions: [{
        ...validResult.repetitions[0]!,
        metrics: { ...validResult.repetitions[0]!.metrics, sent: "one" },
      }],
    };
    expect(BenchmarkResultSchema.safeParse(wrongType).success).toBe(false);
  });
});
