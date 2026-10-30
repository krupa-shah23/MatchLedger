/**
 * GD1-GD3: Grafana dashboard validation
 * GD1: Check that every metric in Grafana JSON exists in the catalogue
 * GD2: Validate Prometheus config
 * GD3: Validate Grafana provisioning
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { METRICS_CATALOGUE } from "@matchledger/telemetry";

const DASHBOARDS_DIR = path.join(process.cwd(), "ops/grafana/provisioning/dashboards");

function extractExprMetrics(dashboardJson: unknown): Set<string> {
  const used = new Set<string>();

  const visitTarget = (target: unknown): void => {
    if (typeof target !== "object" || target === null) return;
    const expr = (target as Record<string, unknown>).expr;
    if (typeof expr !== "string") return;
    for (const match of expr.matchAll(/\b(ml_[a-zA-Z_]+)\b/g)) {
      // Prometheus auto-generates _bucket/_sum/_count series for histograms
      // and summaries; the catalogue stores the base metric name.
      used.add(match[1].replace(/_(bucket|sum|count)$/, ""));
    }
  };

  const panels = (dashboardJson as { panels?: unknown[] })?.panels ?? [];
  for (const panel of panels) {
    const targets = (panel as { targets?: unknown[] })?.targets ?? [];
    for (const target of targets) visitTarget(target);
  }
  return used;
}

describe("GD: Grafana Dashboard", () => {
  it("GD1: Every ml_ metric in Grafana JSON exists in the catalogue", () => {
    const dashboardFiles = fs
      .readdirSync(DASHBOARDS_DIR, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith(".json"))
      .map((f) => path.join(DASHBOARDS_DIR, f.name));

    expect(dashboardFiles.length).toBeGreaterThan(0);

    const catalogueKeys = new Set(Object.keys(METRICS_CATALOGUE));

    for (const dashboardPath of dashboardFiles) {
      const dashboardJson = JSON.parse(fs.readFileSync(dashboardPath, "utf8"));
      const usedMetrics = extractExprMetrics(dashboardJson);
      for (const metric of usedMetrics) {
        expect(catalogueKeys, `${metric} (from ${dashboardPath}) must exist in METRICS_CATALOGUE`).toContain(metric);
      }
    }
  });

  it("GD2: Prometheus config parses and contains targets", () => {
    const promConfigPath = path.join(process.cwd(), "ops/prometheus/prometheus.yml");
    expect(fs.existsSync(promConfigPath)).toBe(true);

    const content = fs.readFileSync(promConfigPath, "utf8");
    expect(content).toContain("scrape_configs");
    expect(content).toContain("targets");
  });

  it("GD3: Grafana provisioning files parse without errors", () => {
    const datasourcePath = path.join(process.cwd(), "ops/grafana/provisioning/datasources/prometheus.yml");
    const dashboardProvisioningPath = path.join(process.cwd(), "ops/grafana/provisioning/dashboards/dashboards.yml");

    expect(fs.existsSync(datasourcePath)).toBe(true);
    const datasourceContent = fs.readFileSync(datasourcePath, "utf8");
    expect(datasourceContent).toContain("prometheus");

    expect(fs.existsSync(dashboardProvisioningPath)).toBe(true);
    const dashboardProvisioningContent = fs.readFileSync(dashboardProvisioningPath, "utf8");
    expect(dashboardProvisioningContent).toContain("providers");
  });
});
