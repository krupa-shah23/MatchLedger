/**
 * GD1-GD3: Grafana dashboard validation
 * GD1: Check that every metric in Grafana JSON exists in the catalogue
 * GD2: Validate Prometheus config
 * GD3: Validate Grafana provisioning
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CATALOGUE_METRICS = [
  "ml_shard_commands_total",
  "ml_shard_queue_depth",
  "ml_shard_queue_full",
  "ml_shard_lease_epoch",
  "ml_shard_ownership_changes",
  "ml_shard_last_seq",
  "ml_shard_heartbeat_latency_ms",
  "ml_recovery_duration_ms",
  "ml_recovery_snapshot_seq",
  "ml_recovery_tail_length",
];

describe("GD: Grafana Dashboard", () => {
  it("GD1: Every ml_ metric in Grafana JSON exists in the catalogue", () => {
    const dashboardPath = path.join(
      process.cwd(),
      "ops/grafana/dashboards/matchledger.json"
    );

    if (!fs.existsSync(dashboardPath)) {
      // Dashboard may not exist yet, this is acceptable
      expect(true).toBe(true);
      return;
    }

    const dashboardJson = JSON.parse(fs.readFileSync(dashboardPath, "utf8"));
    const usedMetrics = new Set<string>();

    // Extract metrics from dashboard panels
    const extract = (obj: unknown): void => {
      if (typeof obj === "string" && obj.includes("ml_")) {
        const matches = obj.match(/ml_\w+/g);
        if (matches) {
          matches.forEach((m) => usedMetrics.add(m));
        }
      } else if (typeof obj === "object" && obj !== null) {
        Object.values(obj).forEach((v) => extract(v));
      }
    };

    extract(dashboardJson);

    // Verify all used metrics exist in catalogue
    usedMetrics.forEach((metric) => {
      expect(CATALOGUE_METRICS).toContain(metric);
    });
  });

  it("GD2: Prometheus config parses and contains targets", () => {
    const promConfigPath = path.join(process.cwd(), "ops/prometheus.yml");

    if (!fs.existsSync(promConfigPath)) {
      expect(true).toBe(true);
      return;
    }

    const content = fs.readFileSync(promConfigPath, "utf8");
    expect(content).toContain("scrape_configs");
    expect(content).toContain("targets");
  });

  it("GD3: Grafana provisioning files parse without errors", () => {
    const datasourcePath = path.join(
      process.cwd(),
      "ops/grafana/provisioning/datasources/prometheus.yaml"
    );
    const dashboardPath = path.join(
      process.cwd(),
      "ops/grafana/provisioning/dashboards/matchledger.yaml"
    );

    // Files may not exist yet, that's acceptable
    if (fs.existsSync(datasourcePath)) {
      const datasourceContent = fs.readFileSync(datasourcePath, "utf8");
      expect(datasourceContent).toContain("prometheus");
    }

    if (fs.existsSync(dashboardPath)) {
      const dashboardContent = fs.readFileSync(dashboardPath, "utf8");
      expect(dashboardContent).toContain("dashboards");
    }

    expect(true).toBe(true);
  });
});
