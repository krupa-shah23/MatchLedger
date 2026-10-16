import { createHash } from "node:crypto";
import pg from "pg";
import { createSqlExecutor } from "@matchledger/journal";

// TODO: wire recoverPipeline properly
const recoverPipeline = async () => ({ runner: null, stage: null, router: null, ledger: null });

// Seeded PRNG (mulberry32)
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Args {
  seed: number;
  schema: string;
  steps: number;
  snapshotEvery: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const seed = parseInt(args[args.indexOf("--seed") + 1] || "1");
  const schema = args[args.indexOf("--schema") + 1] || "chaos";
  const steps = parseInt(args[args.indexOf("--steps") + 1] || "100");
  const snapshotEvery = parseInt(args[args.indexOf("--snapshot-every") + 1] || "10");
  return { seed, schema, steps, snapshotEvery };
}

function computeStateHash(): string {
  // TODO: canonical dump of engine events, books, risk exportState, ledger, reservations
  return createHash("sha256").update("deterministic").digest("hex");
}

async function main() {
  const args = parseArgs();
  const rng = mulberry32(args.seed);

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:matchledger@localhost:5432/postgres",
  });

  try {
    const sql = createSqlExecutor(pool);

    // Recover
    const handle = await recoverPipeline();

    // Run steps
    for (let i = 0; i < args.steps; i++) {
      // TODO: submit deterministic orders
      // await stage.whenIdle()
    }

    const hash = computeStateHash();
    console.log(`DONE ${hash}`);
    process.exit(0);
  } catch (err) {
    console.error("CRASH", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
