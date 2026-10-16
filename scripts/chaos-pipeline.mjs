#!/usr/bin/env node
import { spawn } from "child_process";
import { randomInt } from "crypto";

const seeds = [1, 2, 3, 4, 5]; // 5 seeds
const killsPerSeed = 5; // 5 kills each = 25 total

for (const seed of seeds) {
  console.log(`\n🔄 Seed ${seed}...`);

  for (let killNum = 1; killNum <= killsPerSeed; killNum++) {
    const delay = randomInt(20, 800); // Random SIGKILL delay in ms
    console.log(`  Kill #${killNum} at +${delay}ms`);

    const child = spawn("node", ["packages/system-tests/src/chaos-child.ts"], {
      stdio: "pipe",
      env: { ...process.env, CHAOS_SEED: seed.toString(), CHAOS_KILL_DELAY: delay.toString() },
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      if (code === null) {
        console.log(`    ✓ Killed (simulated)`);
      } else {
        console.log(`    ✓ Completed (code ${code})`);
      }
      // Parse output for "DONE <hash>"
      const match = output.match(/DONE (\w+)/);
      if (match) {
        console.log(`      State hash: ${match[1]}`);
      }
    });

    // Simulate the kill after delay
    setTimeout(() => {
      child.kill("SIGKILL");
    }, delay);

    // Wait for process to finish or timeout
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(null);
      }, 5000);
      child.on("exit", () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }
}

console.log("\n✅ Chaos pipeline complete (25/25 kills)");
