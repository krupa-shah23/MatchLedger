#!/usr/bin/env node
/**
 * Validate dashboard panel metrics against METRICS_CATALOGUE.
 * Ensures all metrics in Grafana panels are defined in the telemetry catalogue.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// Import metrics catalogue
const registryPath = resolve(process.cwd(), 'packages/telemetry/src/registry.ts');
const registrySource = readFileSync(registryPath, 'utf8');

// Parse METRICS_CATALOGUE from registry.ts (line-by-line extraction)
const catalogueKeys = new Set();
const lines = registrySource.split('\n');
for (const line of lines) {
  const match = line.match(/^  "(ml_[^"]+)"/);
  if (match) {
    catalogueKeys.add(match[1]);
  }
}

console.log(`Found ${catalogueKeys.size} metrics in METRICS_CATALOGUE`);

// Find and validate all dashboard JSON files
const dashboardsPath = resolve(process.cwd(), 'ops/grafana/provisioning/dashboards');
let dashboardCount = 0;
let panelCount = 0;
let missingMetrics = [];

try {
  const dashboardFiles = readdirSync(dashboardsPath, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.json'))
    .map(f => resolve(dashboardsPath, f.name));

  for (const dashboardFile of dashboardFiles) {
    const dashboardJson = JSON.parse(readFileSync(dashboardFile, 'utf8'));
    dashboardCount++;

    const panels = dashboardJson.panels || [];
    for (const panel of panels) {
      panelCount++;
      const targets = panel.targets || [];

      for (const target of targets) {
        if (!target.expr) continue;

        // Extract metric names from Prometheus expr (simple extraction)
        const metricMatches = target.expr.matchAll(/\b(ml_[a-zA-Z_]+)\b/g);
        for (const match of metricMatches) {
          const metricName = match[1];
          if (!catalogueKeys.has(metricName)) {
            missingMetrics.push({
              dashboard: dashboardFile,
              panel: panel.title || 'unknown',
              metric: metricName,
              expr: target.expr,
            });
          }
        }
      }
    }
  }
} catch (err) {
  console.error(`Error reading dashboards: ${err.message}`);
  process.exit(1);
}

// Report results
console.log(`\nValidated ${dashboardCount} dashboard(s) with ${panelCount} panel(s)`);

if (missingMetrics.length > 0) {
  console.error(`\n❌ Found ${missingMetrics.length} metric(s) not in METRICS_CATALOGUE:`);
  const grouped = {};
  for (const item of missingMetrics) {
    const key = item.metric;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`${item.dashboard} (panel: ${item.panel})`);
  }

  for (const [metric, locations] of Object.entries(grouped)) {
    console.error(`  - ${metric}`);
    for (const loc of locations) {
      console.error(`      ${loc}`);
    }
  }
  process.exit(1);
}

console.log('✓ All dashboard metrics are in METRICS_CATALOGUE');
