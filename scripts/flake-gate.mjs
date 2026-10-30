import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_RUNS = 20;
const DEFAULT_PATHS = [
  "packages/api",
  "packages/shard",
  "packages/risk",
  "packages/common",
  "packages/ledger",
  "packages/recon",
  "packages/system-tests",
  "packages/telemetry",
  "packages/simulator",
];

const args = process.argv.slice(2);

function parseArgs(argv) {
  let runs = DEFAULT_RUNS;
  let paths = [...DEFAULT_PATHS];
  let project = "all";
  let includeWeb = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--runs") {
      const next = argv[index + 1];
      if (next === undefined) {
        throw new Error("Missing value for --runs");
      }
      runs = Number.parseInt(next, 10);
      if (!Number.isInteger(runs) || runs <= 0) {
        throw new Error(`Invalid --runs value: ${next}`);
      }
      index += 1;
      continue;
    }

    if (arg === "--paths") {
      const next = argv[index + 1];
      if (next === undefined) {
        throw new Error("Missing value for --paths");
      }
      paths = next
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (paths.length === 0) {
        throw new Error("--paths must include at least one path");
      }
      index += 1;
      continue;
    }

    if (arg === "--no-web") {
      includeWeb = false;
      continue;
    }

    if (arg === "--project") {
      const next = argv[index + 1];
      if (next === undefined) {
        throw new Error("Missing value for --project");
      }
      const normalized = next.toLowerCase();
      if (normalized !== "unit" && normalized !== "integration" && normalized !== "all") {
        throw new Error(`Unsupported --project value: ${next}`);
      }
      project = normalized;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { runs, paths, project, includeWeb };
}

function runCommand(argsList, cwd) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawnSync(command, argsList, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
}

function printOutput(label, output) {
  if (output && output.trim()) {
    process.stdout.write(`\n--- ${label} ---\n${output}`);
  }
}

/**
 * Builds the list of {label, argsList, cwd} targets to run each iteration,
 * based on --project and --paths/--no-web.
 *
 * Root packages (packages/*) share the root vitest config and can be run as
 * one `vitest run <paths...>` invocation. web/ is a separate npm workspace
 * with its own vitest config (happy-dom, React plugin) and is not matched by
 * the root config's include glob, so it is always run as its own
 * `npx vitest run` invocation from web/'s cwd. The integration project runs
 * against vitest-integration.config.ts.
 */
function buildTargets({ paths, project, includeWeb }) {
  const targets = [];

  if (project === "unit" || project === "all") {
    targets.push({ label: "unit (root packages)", argsList: ["vitest", "run", ...paths], cwd: ROOT });
    if (includeWeb) {
      targets.push({ label: "unit (web)", argsList: ["vitest", "run"], cwd: path.join(ROOT, "web") });
    }
  }

  if (project === "integration" || project === "all") {
    targets.push({
      label: "integration",
      argsList: ["vitest", "run", "--config", "vitest-integration.config.ts"],
      cwd: ROOT,
    });
  }

  return targets;
}

try {
  const { runs, paths, project, includeWeb } = parseArgs(args);
  const targets = buildTargets({ paths, project, includeWeb });

  for (let iteration = 1; iteration <= runs; iteration += 1) {
    for (const target of targets) {
      const child = runCommand(target.argsList, target.cwd);

      if (child.stdout) {
        process.stdout.write(child.stdout);
      }
      if (child.stderr) {
        process.stderr.write(child.stderr);
      }

      if (child.error) {
        console.error(`\nFlake gate failed at iteration ${iteration}/${runs} (${target.label}): spawn error`);
        console.error(child.error.message);
        process.exit(1);
      }

      if (child.status !== 0) {
        console.error(`\nFlake gate failed at iteration ${iteration}/${runs} (${target.label})`);
        printOutput("stdout", child.stdout);
        printOutput("stderr", child.stderr);
        process.exit(child.status ?? 1);
      }
    }
  }

  console.log(`${runs}/${runs} green across: ${targets.map((t) => t.label).join(", ")}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
