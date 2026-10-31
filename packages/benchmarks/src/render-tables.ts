import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BenchmarkResultSchema, type BenchmarkResult } from "./results-schema.js";
import { findRepositoryRoot } from "./repo-root.js";

export const GENERATED_BEGIN = "<!-- generated:benchmark-results:begin -->";
export const GENERATED_END = "<!-- generated:benchmark-results:end -->";

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.0+$|(?<=\.[0-9]*?)0+$/u, "").replace(/\.$/u, "");
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderResultsTable(input: readonly BenchmarkResult[]): string {
  const results = input.map((result) => BenchmarkResultSchema.parse(result));
  const rows = results.flatMap((result) => result.repetitions.map((repetition) => {
    const metrics = repetition.metrics;
    const reasons = repetition.invalidReasons.length === 0
      ? ""
      : ` (${repetition.invalidReasons.map(escapeMarkdown).join("; ")})`;
    return `| ${escapeMarkdown(result.experiment)} | ${escapeMarkdown(result.environment.gitShortSha)} | ${repetition.index} | ${metrics.sent} | ${metrics.accepted} | ${metrics.rejected} | ${metrics.dropped_iterations} | ${formatNumber(metrics.acceptedOrdersPerSecond)} | ${formatNumber(metrics.latencyMs.p50)} | ${formatNumber(metrics.latencyMs.p95)} | ${formatNumber(metrics.latencyMs.p99)} | ${repetition.valid ? "valid" : `INVALID${reasons}`} |`;
  }));
  return [
    "| Experiment | Git SHA | Rep | Sent | Accepted | Rejected | Dropped | Accepted orders/s | p50 ms | p95 ms | p99 ms | Status |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows,
  ].join("\n");
}

export function renderExperimentBlock(input: readonly BenchmarkResult[]): string {
  const results = input.map((result) => BenchmarkResultSchema.parse(result));
  if (results.length === 0) return "_No benchmark result files have been recorded._";
  const experiments = [...new Set(results.map((result) => result.experiment))].sort();
  const charts = experiments.map((experiment) =>
    `![${escapeMarkdown(experiment)} throughput](../packages/benchmarks/results/${experiment}/throughput.svg)`).join("\n\n");
  return `${renderResultsTable(results)}\n\n${charts}`;
}

export function replaceGeneratedBlock(document: string, generated: string): string {
  const beginIndex = document.indexOf(GENERATED_BEGIN);
  const endIndex = document.indexOf(GENERATED_END);
  if (beginIndex < 0 || endIndex < 0 || endIndex < beginIndex) {
    throw new Error("docs/experiments.md must contain the benchmark generated-block markers");
  }
  const contentStart = beginIndex + GENERATED_BEGIN.length;
  return `${document.slice(0, contentStart)}\n${generated}\n${document.slice(endIndex)}`;
}

export async function readBenchmarkResults(resultsRoot: string): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  async function visit(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) {
        results.push(BenchmarkResultSchema.parse(JSON.parse(await readFile(path, "utf8"))));
      }
    }
  }
  await visit(resultsRoot);
  return results.sort((left, right) =>
    left.runAt.localeCompare(right.runAt) || left.experiment.localeCompare(right.experiment));
}

export async function updateExperimentsDocument(options: {
  readonly resultsRoot?: string;
  readonly documentPath?: string;
} = {}): Promise<void> {
  const cwd = await findRepositoryRoot();
  const results = await readBenchmarkResults(options.resultsRoot ?? resolve(cwd, "packages/benchmarks/results"));
  const documentPath = options.documentPath ?? resolve(cwd, "docs/experiments.md");
  const document = await readFile(documentPath, "utf8");
  await writeFile(documentPath, replaceGeneratedBlock(document, renderExperimentBlock(results)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  updateExperimentsDocument()
    .then(() => process.stdout.write("Generated benchmark table block in docs/experiments.md.\n"))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
