#!/usr/bin/env node
import { spawn } from "child_process";

// Simple seeded PRNG (mulberry32)
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function runChildProcess(config) {
  return new Promise((resolve, reject) => {
    const args = [
      `--database-url=${config.dbUrl}`,
      `--schema=${config.schema}`,
      `--seed=${config.seed}`,
      `--total=${config.total}`,
      `--snapshot-every=${config.snapshotEvery}`,
    ];

    const child = spawn("node", [
      "packages/system-tests/dist/chaos-child.js",
      ...args,
    ]);

    let stdout = "";
    let stderr = "";
    let finished = false;

    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      const lines = text.trim().split("\n");
      for (const line of lines) {
        if (line.startsWith("{")) {
          try {
            const json = JSON.parse(line);
            if (json.phase === "done") {
              finished = true;
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const killTimeout = setTimeout(() => {
      if (!finished) {
        child.kill("SIGKILL");
      }
    }, config.killDelayMs);

    child.on("close", (code) => {
      clearTimeout(killTimeout);
      if (finished && code === 0) {
        resolve({ code, stdout, stderr, killed: false });
      } else if (code === null) {
        resolve({ code: -15, stdout, stderr, killed: true });
      } else {
        resolve({ code, stdout, stderr, killed: false });
      }
    });

    child.on("error", reject);
  });
}

async function main() {
  const killsArg = process.argv.find((a) => a.startsWith("--kills="));
  const totalArg = process.argv.find((a) => a.startsWith("--total="));
  const seedArg = process.argv.find((a) => a.startsWith("--seed="));

  const kills = killsArg ? parseInt(killsArg.split("=")[1]) : 15;
  const total = totalArg ? parseInt(totalArg.split("=")[1]) : 600;
  const baseSeed = seedArg ? parseInt(seedArg.split("=")[1]) : 1;

  const schema = `chaos_${Date.now()}`;
  const dbUrl = "postgres://localhost/matchledger";

  console.log(
    `🔥 Chaos pipeline: ${kills} kills over ${total} actions, seed ${baseSeed}`
  );
  console.log(`Schema: ${schema}`);

  let kills_executed = 0;
  let restarts = 0;
  const recoveryTimes = [];

  for (let round = 0; round < 100; round++) {
    const prng = mulberry32(baseSeed + round);
    const killDelayMs = Math.floor(prng() * 860) + 40;

    console.log(
      `\n[Round ${round + 1}] Kill delay: ${killDelayMs}ms, Kills: ${kills_executed}/${kills}`
    );

    const result = await runChildProcess({
      dbUrl,
      schema,
      seed: baseSeed,
      total,
      snapshotEvery: 50,
      killDelayMs,
    });

    if (result.killed) {
      kills_executed++;
      restarts++;
      console.log(`  Killed (restart ${restarts})`);
    } else if (result.code === 0) {
      console.log(`  Finished successfully`);

      // Parse recovery times
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.phase === "recovered" && json.recoveryMs) {
            recoveryTimes.push(json.recoveryMs);
            console.log(`  Recovery time: ${json.recoveryMs}ms`);
          }
        } catch {
          // ignore
        }
      }

      if (kills_executed >= kills) {
        console.log(`\n✅ Chaos pipeline PASS`);
        console.log(`  Total kills: ${kills_executed}`);
        console.log(`  Total restarts: ${restarts}`);
        console.log(
          `  Avg recovery time: ${(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length).toFixed(0)}ms`
        );
        process.exit(0);
      }
    } else {
      console.error(`  Failed with code ${result.code}`);
      if (result.stderr) {
        console.error(`  Stderr: ${result.stderr.substring(0, 200)}`);
      }
      console.log(`\n❌ Chaos pipeline FAIL`);
      process.exit(1);
    }
  }

  console.log(`\n❌ Chaos pipeline FAIL (did not reach kill target)`);
  process.exit(1);
}

main().catch(console.error);
