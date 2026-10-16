#!/usr/bin/env node

import { spawn } from "child_process";

const crashPoints = [
  "BEFORE_ENGINE_CMD",
  "AFTER_ENGINE_CMD",
  "AFTER_RISK_CMD",
  "AFTER_RISK_SNAPSHOT",
  "AFTER_LEDGER_ENTRIES",
  "AFTER_RECON_STATE",
];

async function runTest(crashPoint) {
  return new Promise((resolve) => {
    const env = { ...process.env, CRASH_POINT: crashPoint };
    const test = spawn("npm", ["test", "--", "crash-windows.test.ts"], { env });
    test.on("close", (code) => {
      console.log(`[${crashPoint}] exit code: ${code}`);
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log("🔥 Starting chaos pipeline tests...");
  let passed = 0;
  for (const point of crashPoints) {
    const result = await runTest(point);
    if (result) passed++;
  }
  console.log(`\n✅ Chaos tests: ${passed}/${crashPoints.length} passed`);
  process.exit(passed === crashPoints.length ? 0 : 1);
}

main();
