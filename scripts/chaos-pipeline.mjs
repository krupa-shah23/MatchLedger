#!/usr/bin/env node
import { spawn } from "child_process";
import pg from "pg";
import { randomBytes } from "crypto";

const args = process.argv.slice(2);
const seed = parseInt(args[args.indexOf("--seed") + 1] || "1");
const iterations = parseInt(args[args.indexOf("--iterations") + 1] || "1");
const kills = parseInt(args[args.indexOf("--kills") + 1] || "5");
const steps = parseInt(args[args.indexOf("--steps") + 1] || "100");
const keep = args.includes("--keep");

const db = process.env.DATABASE_URL || "postgres://postgres:matchledger@localhost:5432/postgres";
const pool = new pg.Pool({ connectionString: db });

async function runChild(schema, killAfterMs = null) {
  return new Promise((resolve) => {
    const child = spawn("ts-node", [
      "packages/system-tests/src/chaos-child.ts",
      "--seed", seed.toString(),
      "--schema", schema,
      "--steps", steps.toString(),
      "--snapshot-every", "10",
    ], {
      env: { ...process.env, DATABASE_URL: db },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    let killTimer = null;
    if (killAfterMs !== null) {
      killTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, killAfterMs);
    }

    child.on("exit", (code) => {
      if (killTimer) clearTimeout(killTimer);
      const done = output.match(/DONE ([a-f0-9]+)/);
      resolve({ code, done: done?.[1], killed: code === null });
    });
  });
}

async function createSchema(name) {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    await client.query(`CREATE SCHEMA ${name}`);
  } finally {
    client.release();
  }
}

async function dropSchema(name) {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`Chaos Pipeline: seed=${seed}, iterations=${iterations}, kills=${kills}, steps=${steps}`);

  const results = [];

  for (let iter = 0; iter < iterations; iter++) {
    const refSchema = `chaos_ref_${seed}_${iter}`;
    const chaosSchema = `chaos_chaos_${seed}_${iter}`;

    try {
      // Reference run
      await createSchema(refSchema);
      const refResult = await runChild(refSchema);
      console.log(`[${iter}] Reference: ${refResult.done}`);

      // Chaos run
      await createSchema(chaosSchema);
      let killCount = 0;
      let recovered = 0;
      let lastResult = null;

      for (let k = 0; k <= kills; k++) {
        const killAtMs = k < kills ? Math.random() * 800 + 20 : null;
        const result = await runChild(chaosSchema, killAtMs);

        if (result.killed) {
          killCount++;
          recovered++;
        }

        if (result.done) {
          lastResult = result;
          break;
        }
      }

      const equal = lastResult?.done === refResult.done ? "EQUAL" : "DIFFERENT";
      console.log(`[${iter}] Chaos: kills=${killCount}, recovered=${recovered}, ${equal}`);

      results.push({
        seed,
        iter,
        kills: killCount,
        recoveries: recovered,
        equal,
      });

      if (!keep) {
        await dropSchema(refSchema);
        await dropSchema(chaosSchema);
      }
    } catch (err) {
      console.error(`[${iter}] Error:`, err.message);
    }
  }

  console.table(results);
  process.exit(results.some((r) => r.equal === "DIFFERENT") ? 1 : 0);
}

main().finally(() => pool.end());
