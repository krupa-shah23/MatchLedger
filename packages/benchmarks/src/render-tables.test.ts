import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validBenchmarkFixture as validResult } from "./benchmark-fixture.js";
import {
  GENERATED_BEGIN,
  GENERATED_END,
  readBenchmarkResults,
  renderExperimentBlock,
  renderResultsTable,
} from "./render-tables.js";

describe("LG4: result Markdown renderer", () => {
  it("LG4: renders the fixed fixture with a single two-decimal rounding rule", () => {
    expect(renderResultsTable([validResult])).toBe([
      "| Experiment | Git SHA | Rep | Sent | Accepted | Rejected | Dropped | Accepted orders/s | p50 ms | p95 ms | p99 ms | Status |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
      "| fixture-run | fixture-sha | 1 | 1 | 1 | 0 | 0 | 1.24 | 1.23 | 1.26 | 2 | valid |",
    ].join("\n"));
  });

  it("LG4: rejects an incomplete result before rendering it", () => {
    const incomplete = { ...validResult, environment: undefined };
    expect(() => renderResultsTable([incomplete as never])).toThrow();
  });
});

describe("RC2: generated experiment document block", () => {
  it("RC2: matches freshly rendered result files between the documented markers", async () => {
    const document = await readFile(resolve(process.cwd(), "docs/experiments.md"), "utf8");
    const begin = document.indexOf(GENERATED_BEGIN);
    const end = document.indexOf(GENERATED_END);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);
    const content = document.slice(begin + GENERATED_BEGIN.length + 1, end - 1);
    const results = await readBenchmarkResults(resolve(process.cwd(), "packages/benchmarks/results"));
    expect(content).toBe(renderExperimentBlock(results));
  });
});
