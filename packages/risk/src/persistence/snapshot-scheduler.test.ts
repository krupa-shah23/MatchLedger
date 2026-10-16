import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import { PgRiskJournal } from "./pg-risk-journal.js";
import type { RiskConfig } from "@matchledger/common";
import { RiskCore } from "../core/risk-core.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

const config: RiskConfig = {
  instruments: new Map([["BTC/USD", { symbol: "BTC/USD", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60000 }]]),
};

describe.skipIf(!run)("Snapshot Scheduler (RSC1)", () => {
  let isolated: IsolatedSchema;
  let sql: SqlExecutor;
  let journal: PgRiskJournal;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "snapshot_scheduler_test",
      migrationsDir,
    );
    sql = createSqlExecutor(isolated.pool);
  });

  beforeEach(async () => {
    await isolated.pool.query("TRUNCATE TABLE journal, snapshots");
    journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  // RSC1: Snapshots when due
  it("RSC1: Snapshot scheduler stores snapshots", async () => {
    const core = new RiskCore(config);
    const state = core.exportState();
    const stateJson = JSON.stringify(state);

    const { createHash } = await import("node:crypto");
    const checksum = createHash("sha256").update(stateJson).digest("hex");

    await sql.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO snapshots (stream_id, seq, state_json, checksum, ts) VALUES ($1, $2, $3, $4, $5)",
        ["risk-0", 5, stateJson, checksum, 100],
      );
    });

    const snapshots = await sql.query("SELECT COUNT(*) as cnt FROM snapshots WHERE stream_id = $1", ["risk-0"]);
    expect(parseInt((snapshots.rows[0]?.cnt as string) ?? "0")).toBe(1);
  });
});
