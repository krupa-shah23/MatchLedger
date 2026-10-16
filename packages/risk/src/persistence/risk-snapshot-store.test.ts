/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import type { RiskState } from "@matchledger/common";
import { RiskSnapshotStore } from "./risk-snapshot-store.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

function state(overrides: Partial<RiskState> = {}): RiskState {
  return {
    version: 1,
    partition: 0,
    instruments: [{ symbol: "ACME", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60_000 }],
    accounts: [{ accountId: "A", cash: 9_007_199_254_740_993n, heldCash: 0n, positions: [] }],
    reservations: [],
    decidedOrders: [],
    seenRequestIds: [],
    seenAdjustmentIds: [],
    haltedSymbols: [],
    ...overrides,
  };
}

describe.skipIf(!run)("RiskSnapshotStore (RSS1-RSS5)", () => {
  let isolated: IsolatedSchema;
  let pool: IsolatedSchema["pool"];
  let sql: SqlExecutor;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "risk_snapshot_test",
      migrationsDir,
    );
    pool = isolated.pool;
    sql = createSqlExecutor(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE snapshots");
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  // RSS1: round trip with exact bigints
  it("RSS1: round trip preserves exact bigint values above 2^53", async () => {
    const store = new RiskSnapshotStore(sql);
    const s = state();
    await store.save(0, 100, 1000, s);

    const candidates = await store.listCandidates(0, 100);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.invalid).toBeUndefined();
    expect(candidates[0]!.state).toEqual(s);
    expect(candidates[0]!.state!.accounts[0]!.cash).toBe(9_007_199_254_740_993n);
  });

  // RSS2: newest valid first
  it("RSS2: candidates are returned newest first", async () => {
    const store = new RiskSnapshotStore(sql);
    await store.save(0, 50, 500, state());
    await store.save(0, 100, 1000, state());
    await store.save(0, 150, 1500, state());

    const candidates = await store.listCandidates(0, 200);
    expect(candidates.map((c) => c.lastSeq)).toEqual([150, 100, 50]);
  });

  // RSS3: corrupt checksum skipped and reported
  it("RSS3: a snapshot with a corrupted checksum is reported invalid, not thrown", async () => {
    const store = new RiskSnapshotStore(sql);
    await store.save(0, 100, 1000, state());
    await pool.query("UPDATE snapshots SET checksum = 'deadbeef' WHERE stream_id = 'risk-snapshot-0' AND last_seq = 100");

    const candidates = await store.listCandidates(0, 100);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.invalid).toBe("CHECKSUM");
  });

  // RSS4: unknown version skipped
  it("RSS4: an unknown schema version is reported invalid", async () => {
    const store = new RiskSnapshotStore(sql);
    await store.save(0, 100, 1000, state());
    await pool.query("UPDATE snapshots SET schema_version = 99 WHERE stream_id = 'risk-snapshot-0' AND last_seq = 100");

    const candidates = await store.listCandidates(0, 100);
    expect(candidates[0]!.invalid).toBe("VERSION");
  });

  // RSS5: snapshot ahead of the journal is skipped (via maxSeq filter)
  it("RSS5: a snapshot ahead of maxSeq is excluded from candidates", async () => {
    const store = new RiskSnapshotStore(sql);
    await store.save(0, 100, 1000, state());
    await store.save(0, 500, 5000, state());

    const candidates = await store.listCandidates(0, 100); // maxSeq = journal's actual lastSeq
    expect(candidates.map((c) => c.lastSeq)).toEqual([100]); // the seq=500 snapshot is excluded
  });

  // Extra: prune keeps only the newest N
  it("prune keeps only the newest N snapshots", async () => {
    const store = new RiskSnapshotStore(sql);
    await store.save(0, 50, 500, state());
    await store.save(0, 100, 1000, state());
    await store.save(0, 150, 1500, state());
    await store.prune(0, 1);

    const remaining = await pool.query("SELECT last_seq FROM snapshots WHERE stream_id = 'risk-snapshot-0' ORDER BY last_seq DESC");
    expect(remaining.rows.map((r: any) => Number(r.last_seq))).toEqual([150]);
  });
});
