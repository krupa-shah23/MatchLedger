import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { BenchmarkResult } from "./results-schema.js";
import { BenchmarkResultSchema } from "./results-schema.js";
import { readBenchmarkResults } from "./render-tables.js";
import { findRepositoryRoot } from "./repo-root.js";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 400;
const PLOT = { left: 72, right: 28, top: 48, bottom: 66 } as const;

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function renderThroughputSvg(experiment: string, input: readonly BenchmarkResult[]): string {
  const results = input.map((result) => BenchmarkResultSchema.parse(result))
    .filter((result) => result.experiment === experiment);
  const points = results.flatMap((result) => result.repetitions.map((repetition) => ({
    label: `${result.runAt} rep ${repetition.index}`,
    value: repetition.metrics.acceptedOrdersPerSecond,
    valid: repetition.valid,
  })));
  const plotWidth = CHART_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const coords = points.map((point, index) => {
    const x = points.length < 2 ? PLOT.left + plotWidth / 2 : PLOT.left + (index * plotWidth) / (points.length - 1);
    const y = PLOT.top + plotHeight - (point.value / maxValue) * plotHeight;
    return { ...point, x, y };
  });
  const polyline = coords.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const circles = coords.map((point) =>
    `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4" fill="${point.valid ? "currentColor" : "none"}" stroke="currentColor" data-valid="${point.valid}" aria-label="${escapeXml(point.label)}"/>`).join("");
  const title = `${experiment} accepted orders per second`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-labelledby="chart-title chart-desc">`,
    `<title id="chart-title">${escapeXml(title)}</title>`,
    `<desc id="chart-desc">Accepted orders per second for measured repetitions. Invalid repetitions are marked in the data points.</desc>`,
    `<line x1="${PLOT.left}" y1="${PLOT.top}" x2="${PLOT.left}" y2="${PLOT.top + plotHeight}" stroke="currentColor"/>`,
    `<line x1="${PLOT.left}" y1="${PLOT.top + plotHeight}" x2="${PLOT.left + plotWidth}" y2="${PLOT.top + plotHeight}" stroke="currentColor"/>`,
    `<polyline fill="none" stroke="currentColor" stroke-width="2" points="${polyline}"/>`,
    circles,
    `<text x="${PLOT.left + plotWidth / 2}" y="${CHART_HEIGHT - 18}" text-anchor="middle">Repetition</text>`,
    `<text x="20" y="${PLOT.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 20 ${PLOT.top + plotHeight / 2})">Accepted orders/s</text>`,
    `<text x="${PLOT.left}" y="${PLOT.top - 16}">Unit: orders/s</text>`,
    "</svg>",
  ].join("\n");
}

export async function writeThroughputCharts(options: {
  readonly resultsRoot?: string;
  readonly outputRoot?: string;
} = {}): Promise<string[]> {
  const cwd = await findRepositoryRoot();
  const resultsRoot = options.resultsRoot ?? resolve(cwd, "packages/benchmarks/results");
  const outputRoot = options.outputRoot ?? resultsRoot;
  const results = await readBenchmarkResults(resultsRoot);
  const experiments = [...new Set(results.map((result) => result.experiment))].sort();
  const files: string[] = [];
  for (const experiment of experiments) {
    const directory = resolve(outputRoot, experiment);
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, "throughput.svg");
    await writeFile(path, `${renderThroughputSvg(experiment, results)}\n`);
    files.push(path);
  }
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeThroughputCharts()
    .then((files) => process.stdout.write(`Generated ${files.length} deterministic throughput chart(s).\n`))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
