/**
 * Real unit tests for the chaos.ts helpers' guard rails - the parts that
 * don't require spawning real shard/kafka processes.
 */

import { spawn } from "node:child_process";
import { describe, it, expect, afterEach } from "vitest";
import { blockEventLoop, waitForProcessExit } from "./chaos.js";

describe("chaos.ts guard rails", () => {
  afterEach(() => {
    delete process.env.PROFILE;
    delete process.env.TEST_CHAOS_ENABLED;
  });

  it("blockEventLoop refuses to run outside PROFILE=demo or TEST_CHAOS_ENABLED", () => {
    delete process.env.PROFILE;
    delete process.env.TEST_CHAOS_ENABLED;
    expect(() => blockEventLoop(10)).toThrow(/only allowed in PROFILE=demo/);
  });

  it("blockEventLoop runs and actually blocks for at least the requested duration when enabled", async () => {
    process.env.TEST_CHAOS_ENABLED = "1";
    const start = Date.now();
    await blockEventLoop(30);
    expect(Date.now() - start).toBeGreaterThanOrEqual(30);
  });

  it("waitForProcessExit resolves once the target pid is gone", async () => {
    const child = spawn("node", ["-e", "setTimeout(() => {}, 200)"]);
    if (!child.pid) throw new Error("failed to spawn test child process");
    const elapsedMs = await waitForProcessExit(child.pid, 2000);
    expect(elapsedMs).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it("waitForProcessExit times out against a live process (this own test process)", async () => {
    await expect(waitForProcessExit(process.pid, 200)).rejects.toThrow(/did not exit within/);
  });
});
