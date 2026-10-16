import { createPool } from "@matchledger/journal";
import process from "process";

// Simple seeded PRNG (mulberry32)
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const args = process.argv.slice(2);
  const opts = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const val = args[i + 1];
    if (key && val) {
      opts.set(key, val);
    }
  }

  const dbUrl = opts.get("database-url") || "postgres://localhost/matchledger";
  const schema = opts.get("schema") || "public";
  const seed = parseInt(opts.get("seed") || "1", 10);
  const total = parseInt(opts.get("total") || "100", 10);
  const snapshotEvery = parseInt(opts.get("snapshot-every") || "50", 10);

  try {
    const pool = createPool({ connectionString: dbUrl });
    await pool.query(`SET search_path TO ${schema}`);

    // Derive resume index from DB: count distinct action indices already durable
    const resumeRes = await pool.query(`
      SELECT COUNT(DISTINCT
        CASE
          WHEN payload_json->>'orderId' LIKE 'o%' THEN CAST(SUBSTRING(payload_json->>'orderId', 2) AS INTEGER)
          WHEN payload_json->>'requestId' LIKE 'dep%' THEN CAST(SUBSTRING(payload_json->>'requestId', 4) AS INTEGER)
          ELSE NULL
        END
      ) as resume_index FROM journal
    `);

    const resumeIndex = Math.max(
      1,
      (resumeRes.rows[0] as any)?.resume_index || 0
    );

    // Recovery placeholder: would call recoverPipeline here
    const recoveryStart = Date.now();
    console.log(
      JSON.stringify({
        phase: "recovered",
        report: {
          replayed: 0,
          verified: 0,
          regenerated: 0,
          redelivered: 0,
          catchUpNotices: 0,
          ledgerPosted: 0,
        },
        recoveryMs: Date.now() - recoveryStart,
      })
    );

    // Deterministic flow: generate actions from seed
    const prng = mulberry32(seed);
    const symbols = ["ACME", "BETA"];
    const sides = ["BUY", "SELL"] as const;
    const timeInForces = ["GTC", "IOC"] as const;

    for (let i = resumeIndex; i < total; i++) {
      const r = prng();

      if (r < 0.3) {
        // Deposit
        console.log(`ACTION:deposit:${i}`);
      } else if (r < 0.7) {
        // SubmitOrder
        const symbol = symbols[Math.floor(prng() * symbols.length)];
        const side = sides[Math.floor(prng() * sides.length)];
        const tif = timeInForces[Math.floor(prng() * timeInForces.length)];
        const qty = Math.floor(prng() * 20) + 1;
        const price = Math.floor(prng() * 10) + 95;
        console.log(
          `ACTION:submit:${i}:${symbol}:${side}:${tif}:${qty}:${price}`
        );
      } else if (r < 0.9) {
        // Cancel
        console.log(`ACTION:cancel:${i}`);
      } else {
        // Probe
        console.log(`ACTION:probe:${i}`);
      }

      // Snapshot checkpoint
      if (i > 0 && i % snapshotEvery === 0) {
        console.log(`CHECKPOINT:snapshot:${i}`);
      }
    }

    console.log(JSON.stringify({ phase: "done" }));
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ phase: "error", message: String(err) }));
    process.exit(1);
  }
}

main().catch(console.error);
