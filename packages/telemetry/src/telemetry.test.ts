/**
 * Telemetry package tests (TL1-TL4)
 */

import { describe, it, expect } from "vitest";
import {
  METRICS_CATALOGUE,
  validateMetricName,
} from "./index.js";

describe("Telemetry Registry (TL1-TL4)", () => {
  it("TL1: Catalogue is comprehensive (20+ metrics)", () => {
    const names = Object.keys(METRICS_CATALOGUE);
    expect(names.length).toBeGreaterThanOrEqual(20);
    expect(names).toContain("ml_shard_commands_total");
    expect(names).toContain("ml_eventloop_delay_ms");
    expect(names).toContain("ml_breaker_state");
  });

  it("TL2: All catalogue metrics enforce ml_ prefix", () => {
    for (const def of Object.values(METRICS_CATALOGUE)) {
      expect(def.name).toMatch(/^ml_/);
    }
  });

  it("TL3: Metric creation validates ml_ prefix requirement", () => {
    expect(() => validateMetricName("ml_valid_metric")).not.toThrow();
    expect(() => validateMetricName("invalid_metric")).toThrow();
  });

  it("TL4: Catalogue defines correct metric types and labels", () => {
    const commandsMetric = METRICS_CATALOGUE["ml_shard_commands_total"];
    expect(commandsMetric).toBeDefined();
    expect(commandsMetric?.type).toBe("counter");
    expect(commandsMetric?.labelNames).toContain("shard_id");

    const delayMetric = METRICS_CATALOGUE["ml_eventloop_delay_ms"];
    expect(delayMetric).toBeDefined();
    expect(delayMetric?.type).toBe("histogram");
    expect(delayMetric?.labelNames).toContain("process");

    const breakerMetric = METRICS_CATALOGUE["ml_breaker_state"];
    expect(breakerMetric).toBeDefined();
    expect(breakerMetric?.type).toBe("gauge");
  });
});
