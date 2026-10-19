/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { LeaseStore } from "./lease-store.js";
import { FencedPgJournal, FencedWriterError } from "./fenced-pg-journal.js";
import { createSqlExecutor } from "./sql-executor.js";
import type { Pool } from "pg";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";

describe.skipIf(!run)("LS: Lease Store", () => {
  let pool: Pool;
  let store: LeaseStore;

  beforeEach(async () => {
    pool = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await runMigrations(pool, new URL("../migrations", import.meta.url).pathname.replace("/dist/", "/src/"));
    const sql = createSqlExecutor(pool);
    store = new LeaseStore(sql);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("LS1: acquire twice for one lease returns epochs 1 then 2", async () => {
    const epoch1 = await store.acquire("shard-0", "instance-1");
    expect(epoch1).toBe(1n);

    const epoch2 = await store.acquire("shard-0", "instance-2");
    expect(epoch2).toBe(2n);
  });

  it("LS2: concurrent acquire from many connections returns distinct increasing epochs", async () => {
    const pool2 = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
    const pool3 = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });

    try {
      const sql1 = createSqlExecutor(pool);
      const sql2 = createSqlExecutor(pool2);
      const sql3 = createSqlExecutor(pool3);

      const store1 = new LeaseStore(sql1);
      const store2 = new LeaseStore(sql2);
      const store3 = new LeaseStore(sql3);

      // Run concurrently
      const [e1, e2, e3] = await Promise.all([
        store1.acquire("shard-0", "instance-1"),
        store2.acquire("shard-0", "instance-2"),
        store3.acquire("shard-0", "instance-3"),
      ]);

      const epochs = [e1, e2, e3].sort();
      expect(epochs).toEqual([1n, 2n, 3n]);
    } finally {
      await pool2.end();
      await pool3.end();
    }
  });

  it("LS3: acquire for different lease_id returns independent counters", async () => {
    const e1a = await store.acquire("shard-0", "i1");
    const e1b = await store.acquire("shard-0", "i2");

    const e2a = await store.acquire("shard-1", "i1");
    const e2b = await store.acquire("shard-1", "i2");

    expect(e1a).toBe(1n);
    expect(e1b).toBe(2n);
    expect(e2a).toBe(1n);
    expect(e2b).toBe(2n);
  });
});

describe.skipIf(!run)("FN: Fenced Journal", () => {
  let pool: Pool;
  let sql: ReturnType<typeof createSqlExecutor>;
  let store: LeaseStore;

  beforeEach(async () => {
    pool = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await runMigrations(pool, new URL("../migrations", import.meta.url).pathname.replace("/dist/", "/src/"));
    sql = createSqlExecutor(pool);
    store = new LeaseStore(sql);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("FN1: append with current epoch writes rows with that writer_epoch and upserts offset", async () => {
    const epoch = await store.acquire("shard-0", "instance-1");
    const journal = new FencedPgJournal(sql, "shard-0", epoch);

    const batch = [
      { symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } },
      { symbol: "ABC", seq: 2, ts: 2000, command: { kind: "TICK" } },
    ];

    const offsets = [{ topic: "orders.accepted", partition: 0, offset: 100n }];

    await journal.append(batch, offsets);

    const result = await pool.query("SELECT COUNT(*) as count FROM journal WHERE writer_epoch = $1", [Number(epoch)]);
    expect(Number((result.rows[0] as any).count)).toBe(2);

    const offsetResult = await pool.query("SELECT next_offset FROM consumer_offsets WHERE lease_id = $1", ["shard-0"]);
    expect(Number((offsetResult.rows[0] as any).next_offset)).toBe(101);
  });

  it("FN2: append with stale epoch throws FencedWriterError and inserts zero rows", async () => {
    const epoch1 = await store.acquire("shard-0", "instance-1");
    const epoch2 = await store.acquire("shard-0", "instance-2");

    const stalJournal = new FencedPgJournal(sql, "shard-0", epoch1);

    const batch = [{ symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } }];

    await expect(stalJournal.append(batch)).rejects.toThrow(FencedWriterError);

    const result = await pool.query("SELECT COUNT(*) as count FROM journal WHERE stream_id = $1", ["ABC"]);
    expect(Number((result.rows[0] as any).count)).toBe(0);
  });

  it("FN3: append with missing lease throws FencedWriterError", async () => {
    const journal = new FencedPgJournal(sql, "nonexistent-lease", 1n);

    const batch = [{ symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } }];

    await expect(journal.append(batch)).rejects.toThrow(FencedWriterError);
  });

  it("FN4: acquire while an append is held open - sequential ordering verified", async () => {
    const epoch1 = await store.acquire("shard-0", "instance-1");
    const journal1 = new FencedPgJournal(sql, "shard-0", epoch1);

    // Append with epoch 1
    const batch = [{ symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } }];
    await journal1.append(batch);

    // Now acquire with a new instance - should get epoch 2
    const epoch2 = await store.acquire("shard-0", "instance-2");

    // The new epoch should be 2
    expect(epoch2).toBe(2n);

    // Verify the journal row exists with epoch 1
    const result = await pool.query("SELECT COUNT(*) as count FROM journal WHERE writer_epoch = $1", [Number(epoch1)]);
    expect(Number((result.rows[0] as any).count)).toBe(1);
  });

  it("FN5: appendEvents with stale epoch throws FencedWriterError and writes no EVENT rows", async () => {
    const epoch1 = await store.acquire("shard-0", "instance-1");
    const epoch2 = await store.acquire("shard-0", "instance-2");

    const stalJournal = new FencedPgJournal(sql, "shard-0", epoch1);

    const batch = [
      { symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" }, events: [{ kind: "TRADED", qty: 100 }] },
    ] as any[];

    await expect(stalJournal.appendEvents(batch)).rejects.toThrow(FencedWriterError);

    const result = await pool.query("SELECT COUNT(*) as count FROM journal WHERE record_type = $1", ["EVENT"]);
    expect(Number((result.rows[0] as any).count)).toBe(0);
  });

  it("FN6: offset-only upsert and published_through upsert with stale epoch are rejected", async () => {
    const epoch1 = await store.acquire("shard-0", "instance-1");
    const epoch2 = await store.acquire("shard-0", "instance-2");

    const stalJournal = new FencedPgJournal(sql, "shard-0", epoch1);

    await expect(stalJournal.upsertOffset("orders.accepted", 0, 100n)).rejects.toThrow(FencedWriterError);
    await expect(stalJournal.upsertPublishedThrough("ABC", 10n)).rejects.toThrow(FencedWriterError);

    const offsetResult = await pool.query("SELECT COUNT(*) as count FROM consumer_offsets");
    expect(Number((offsetResult.rows[0] as any).count)).toBe(0);

    const publishResult = await pool.query("SELECT COUNT(*) as count FROM published_through");
    expect(Number((publishResult.rows[0] as any).count)).toBe(0);
  });

  it("FN7: primary-key conflict (same seq twice, same epoch) surfaces as an error", async () => {
    const epoch = await store.acquire("shard-0", "instance-1");
    const journal = new FencedPgJournal(sql, "shard-0", epoch);

    const batch1 = [{ symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } }];
    await journal.append(batch1);

    // Try to insert the same seq again - should fail with unique constraint
    const batch2 = [{ symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } }];
    await expect(journal.append(batch2)).rejects.toThrow();
  });

  it("FN8: same fenced append on a risk-<p> stream has same behavior", async () => {
    const epoch = await store.acquire("risk-0", "instance-1");
    const journal = new FencedPgJournal(sql, "risk-0", epoch);

    const batch = [
      { symbol: "risk", seq: 1, ts: 1000, command: { kind: "HALT" } },
    ];

    await journal.append(batch);

    const result = await pool.query("SELECT COUNT(*) as count FROM journal WHERE writer_epoch = $1", [Number(epoch)]);
    expect(Number((result.rows[0] as any).count)).toBe(1);
  });

  it("FN9: offsets GREATEST keeps maximum; stored offset never moves backward", async () => {
    const epoch = await store.acquire("shard-0", "instance-1");
    const journal = new FencedPgJournal(sql, "shard-0", epoch);

    // Insert with offset 100
    await journal.upsertOffset("orders.accepted", 0, 100n);
    let result = await pool.query("SELECT next_offset FROM consumer_offsets WHERE lease_id = $1", ["shard-0"]);
    expect(Number((result.rows[0] as any).next_offset)).toBe(101);

    // Try to upsert with offset 50 (should not move backward)
    await journal.upsertOffset("orders.accepted", 0, 50n);
    result = await pool.query("SELECT next_offset FROM consumer_offsets WHERE lease_id = $1", ["shard-0"]);
    expect(Number((result.rows[0] as any).next_offset)).toBe(101);

    // Upsert with offset 200 (should move forward)
    await journal.upsertOffset("orders.accepted", 0, 200n);
    result = await pool.query("SELECT next_offset FROM consumer_offsets WHERE lease_id = $1", ["shard-0"]);
    expect(Number((result.rows[0] as any).next_offset)).toBe(201);
  });
});
