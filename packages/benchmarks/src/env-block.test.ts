import { describe, expect, it } from "vitest";
import type { CpuInfo } from "node:os";
import { captureEnvironmentBlock } from "./env-block.js";

describe("LG1: benchmark environment block", () => {
  it("LG1: records all environment fields and blocks dirty trees unless explicitly allowed", async () => {
    const runCommand = async (command: string, args: readonly string[]) => {
      if (command === "docker") return "29.9.0";
      if (args[0] === "rev-parse") return "abc1234";
      if (args[0] === "status") return " M README.md";
      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    };
    const readCgroupFile = async (path: string) => {
      if (path.endsWith("cpu.max")) return "150000 100000";
      if (path.endsWith("memory.max")) return "536870912";
      throw new Error("not present");
    };
    const common = {
      cwd: "/workspace",
      runCommand,
      readCgroupFile,
      cpuInfo: [{ model: "Test CPU" } as CpuInfo],
      ramBytes: 8_589_934_592,
      operatingSystem: "linux",
      kernel: "test-kernel",
      nodeVersion: "v24.0.0",
    };

    await expect(captureEnvironmentBlock({ ...common, argv: [] })).rejects.toThrow(/dirty/);
    const block = await captureEnvironmentBlock({ ...common, argv: ["node", "env-block.js", "--allow-dirty"] });
    expect(block).toMatchObject({
      cpuModel: "Test CPU",
      logicalCores: 1,
      ramBytes: 8_589_934_592,
      os: "linux",
      kernel: "test-kernel",
      nodeVersion: "v24.0.0",
      dockerServerVersion: "29.9.0",
      containerLimits: { cpuCores: 1.5, memoryBytes: 536_870_912 },
      gitShortSha: "abc1234",
      dirty: true,
      dirtyAllowed: true,
    });
  });
});
