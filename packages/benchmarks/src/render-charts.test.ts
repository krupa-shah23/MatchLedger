import { describe, expect, it } from "vitest";
import { validBenchmarkFixture as validResult } from "./benchmark-fixture.js";
import { renderThroughputSvg } from "./render-charts.js";

describe("RC1: deterministic chart renderer", () => {
  it("RC1: emits byte-identical SVG with axis labels and units for the same result", () => {
    const first = renderThroughputSvg("fixture-run", [validResult]);
    const second = renderThroughputSvg("fixture-run", [validResult]);
    expect(first).toBe(second);
    expect(first).toContain("Repetition");
    expect(first).toContain("Accepted orders/s");
    expect(first).toContain("Unit: orders/s");
  });
});
