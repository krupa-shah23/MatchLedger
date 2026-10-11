import { spawnSync } from "node:child_process";

const DEFAULT_RUNS = 20;
const DEFAULT_PATHS = ["packages/api", "packages/shard", "packages/risk", "packages/common", "packages/ledger", "packages/recon", "packages/system-tests"];

const args = process.argv.slice(2);

function parseArgs(argv) {
  let runs = DEFAULT_RUNS;
  let paths = [...DEFAULT_PATHS];
  let project = "unit";

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

    if (arg === "--project") {
      const next = argv[index + 1];
      if (next === undefined) {
        throw new Error("Missing value for --project");
      }
      const normalized = next.toLowerCase();
      if (normalized !== "unit" && normalized !== "integration") {
        throw new Error(`Unsupported --project value: ${next}`);
      }
      project = normalized;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { runs, paths, project };
}

function runCommand(argsList) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawnSync(command, argsList, {
    cwd: process.cwd(),
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

try {
  const { runs, paths, project } = parseArgs(args);

  if (project === "integration") {
    console.log("--project integration is ignored because no integration project exists yet.");
  }

  for (let iteration = 1; iteration <= runs; iteration += 1) {
    const child = runCommand(["vitest", "run", ...paths]);

    if (child.stdout) {
      process.stdout.write(child.stdout);
    }
    if (child.stderr) {
      process.stderr.write(child.stderr);
    }

    if (child.error) {
      console.error(`\nFlake gate failed at iteration ${iteration}/${runs}: spawn error`);
      console.error(child.error.message);
      process.exit(1);
    }

    if (child.status !== 0) {
      console.error(`\nFlake gate failed at iteration ${iteration}/${runs}`);
      printOutput("stdout", child.stdout);
      printOutput("stderr", child.stderr);
      process.exit(child.status ?? 1);
    }
  }

  console.log(`${runs}/${runs} green`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
