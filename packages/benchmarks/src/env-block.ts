import { execFile as execFileCallback } from "node:child_process";
import { readFile as readFileCallback } from "node:fs/promises";
import { cpus, platform, release, totalmem, type CpuInfo } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFile = promisify(execFileCallback);

export interface EnvironmentBlock {
  readonly cpuModel: string;
  readonly logicalCores: number;
  readonly ramBytes: number;
  readonly os: string;
  readonly kernel: string;
  readonly nodeVersion: string;
  readonly dockerServerVersion: string;
  readonly containerLimits: {
    readonly cpuCores: number | null;
    readonly memoryBytes: number | null;
  };
  readonly gitShortSha: string;
  readonly dirty: boolean;
  readonly dirtyAllowed: boolean;
}

export interface EnvironmentBlockOptions {
  readonly argv?: readonly string[];
  readonly cwd?: string;
  readonly runCommand?: (command: string, args: readonly string[], cwd: string) => Promise<string>;
  readonly readCgroupFile?: (path: string) => Promise<string>;
  readonly cpuInfo?: readonly CpuInfo[];
  readonly ramBytes?: number;
  readonly operatingSystem?: string;
  readonly kernel?: string;
  readonly nodeVersion?: string;
}

async function run(command: string, args: readonly string[], cwd: string): Promise<string> {
  const result = await execFile(command, [...args], { cwd, encoding: "utf8" });
  return result.stdout.trim();
}

async function readCgroup(path: string): Promise<string> {
  return readFileCallback(path, "utf8");
}

async function readOptional(path: string, read: (path: string) => Promise<string>): Promise<string | null> {
  try {
    return (await read(path)).trim();
  } catch {
    return null;
  }
}

function parseCpuLimit(v2: string | null, quotaV1: string | null, periodV1: string | null): number | null {
  if (v2) {
    const [quota, period] = v2.split(/\s+/);
    if (quota === "max") return null;
    const quotaValue = Number(quota);
    const periodValue = Number(period);
    return Number.isFinite(quotaValue) && Number.isFinite(periodValue) && quotaValue > 0 && periodValue > 0
      ? quotaValue / periodValue
      : null;
  }
  const quota = Number(quotaV1);
  const period = Number(periodV1);
  return Number.isFinite(quota) && Number.isFinite(period) && quota > 0 && period > 0
    ? quota / period
    : null;
}

function parseMemoryLimit(v2: string | null, v1: string | null): number | null {
  const raw = v2 ?? v1;
  if (!raw || raw === "max") return null;
  const bytes = Number(raw);
  return Number.isFinite(bytes) && bytes > 0 && bytes < 8_000_000_000_000_000_000 ? bytes : null;
}

export async function captureEnvironmentBlock(options: EnvironmentBlockOptions = {}): Promise<EnvironmentBlock> {
  const cwd = options.cwd ?? process.cwd();
  const command = options.runCommand ?? run;
  const read = options.readCgroupFile ?? readCgroup;
  const argv = options.argv ?? process.argv.slice(2);
  const dirtyAllowed = argv.includes("--allow-dirty");

  const [gitShortSha, gitStatus] = await Promise.all([
    command("git", ["rev-parse", "--short", "HEAD"], cwd),
    command("git", ["status", "--porcelain", "--untracked-files=normal"], cwd),
  ]);
  const dirty = gitStatus.length > 0;
  if (dirty && !dirtyAllowed) {
    throw new Error("Benchmark refused: working tree is dirty; pass --allow-dirty to record a dirty result");
  }

  const [dockerServerVersion, cpuMax, memoryMax, cpuQuota, cpuPeriod, memoryLimit] = await Promise.all([
    command("docker", ["version", "--format", "{{.Server.Version}}"], cwd),
    readOptional("/sys/fs/cgroup/cpu.max", read),
    readOptional("/sys/fs/cgroup/memory.max", read),
    readOptional("/sys/fs/cgroup/cpu/cpu.cfs_quota_us", read),
    readOptional("/sys/fs/cgroup/cpu/cpu.cfs_period_us", read),
    readOptional("/sys/fs/cgroup/memory/memory.limit_in_bytes", read),
  ]);
  const cpuInfo = options.cpuInfo ?? cpus();
  const cpuModel = cpuInfo[0]?.model?.trim();
  if (!cpuModel || !gitShortSha || !dockerServerVersion) {
    throw new Error("Benchmark environment is incomplete: CPU model, git SHA, and Docker server version are required");
  }

  return {
    cpuModel,
    logicalCores: cpuInfo.length,
    ramBytes: options.ramBytes ?? totalmem(),
    os: options.operatingSystem ?? platform(),
    kernel: options.kernel ?? release(),
    nodeVersion: options.nodeVersion ?? process.version,
    dockerServerVersion,
    containerLimits: {
      cpuCores: parseCpuLimit(cpuMax, cpuQuota, cpuPeriod),
      memoryBytes: parseMemoryLimit(memoryMax, memoryLimit),
    },
    gitShortSha,
    dirty,
    dirtyAllowed,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  captureEnvironmentBlock()
    .then((block) => process.stdout.write(`${JSON.stringify(block, null, 2)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
