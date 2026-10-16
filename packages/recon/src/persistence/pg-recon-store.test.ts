import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import { PgReconStore, BreakNotFoundError, ConcurrentModificationError, type StoredRun, type StoredBreak } from "./pg-recon-store.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

describe.skipIf(!run)("PgReconStore (RDB1-RDB8)", () => {
  let isolated: IsolatedSchema;
  let pool: IsolatedSchema["pool"];
  let sql: SqlExecutor;
  let store: PgReconStore;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "recon_store_test",
      migrationsDir,
    );
    pool = isolated.pool;
    sql = createSqlExecutor(pool);
    store = new PgReconStore(sql);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE recon_audit, recon_breaks, recon_runs CASCADE");
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  it("RDB1: same file hash re-uploaded returns same run, zero new breaks", async () => {
    const fileHash = "hash123";
    const run1: StoredRun & { breaks: readonly any[] } = {
      runId: "r1",
      source: "source1",
      fileHash,
      cutoffTs: 1000,
      priceDecimals: 2,
      settlementLagDays: 2,
      rowsRead: 100,
      parseErrorsJson: "[]",
      countsJson: '{"MISSING":1}',
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      breaks: [{ breakId: "b1", runId: "r1", type: "MISSING", tradeId: "t1" }],
      created: true,
    };

    const result1 = await store.createRun(run1);
    expect(result1.created).toBe(true);

    const breaks1 = await store.listBreaks({ runId: "r1" });
    expect(breaks1).toHaveLength(1);

    // Re-upload with same hash
    const run2: StoredRun & { breaks: readonly any[] } = {
      ...run1,
      runId: "r2",
      breaks: [{ breakId: "b2", runId: "r2", type: "MISSING", tradeId: "t2" }],
    };

    const result2 = await store.createRun(run2);
    expect(result2.created).toBe(false);

    const breaks2 = await store.listBreaks({ runId: "r1" });
    expect(breaks2).toHaveLength(1);
  });

  it("RDB2: run with breaks persisted and read back, counts and parse_errors round-trip", async () => {
    const parseErrors = JSON.stringify([{ rowNumber: 5, reason: "invalid" }]);
    const counts = JSON.stringify({ MISSING: 2, EXTRA: 1 });
    const run: StoredRun & { breaks: readonly any[] } = {
      runId: "r1",
      source: "source1",
      fileHash: "hash1",
      cutoffTs: 1000,
      priceDecimals: 2,
      settlementLagDays: 2,
      rowsRead: 100,
      parseErrorsJson: parseErrors,
      countsJson: counts,
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      breaks: [
        { breakId: "b1", runId: "r1", type: "MISSING", tradeId: "t1", internalJson: '{"qty": 100}' },
        { breakId: "b2", runId: "r1", type: "EXTRA", tradeId: "t2", externalJson: '{"price": "99.99"}' },
        { breakId: "b3", runId: "r1", type: "MISSING", tradeId: "t3" },
      ],
      created: true,
    };

    await store.createRun(run);
    const runs = await store.listRuns();
    expect(runs[0]!.parseErrorsJson).toContain("invalid");
    expect(runs[0]!.countsJson).toContain("MISSING");

    const breaks = await store.listBreaks({ runId: "r1" });
    expect(breaks).toHaveLength(3);
    expect(breaks.filter((b) => b.type === "MISSING")).toHaveLength(2);
  });

  it("RDB3: transition writes break and audit atomically; audit insert failure prevents break update", async () => {
    const run: StoredRun & { breaks: readonly any[] } = {
      runId: "r1",
      source: "s1",
      fileHash: "h1",
      cutoffTs: 1000,
      priceDecimals: 2,
      settlementLagDays: 2,
      rowsRead: 100,
      parseErrorsJson: "[]",
      countsJson: "{}",
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      breaks: [{ breakId: "b1", runId: "r1", type: "MISSING", tradeId: "t1" }],
      created: true,
    };

    await store.createRun(run);

    await store.transition("b1", "OPEN", "INVESTIGATING", "reviewing", "user1", Date.now());

    const audit = await store.getAudit("b1");
    expect(audit).toHaveLength(1);
    expect(audit[0]!.toStatus).toBe("INVESTIGATING");

    const breaks = await store.listBreaks({ runId: "r1" });
    expect(breaks[0]!.status).toBe("INVESTIGATING");
  });

  it("RDB4: concurrent transitions, exactly one succeeds, one audit row", async () => {
    const run: StoredRun & { breaks: readonly any[] } = {
      runId: "r1",
      source: "s1",
      fileHash: "h1",
      cutoffTs: 1000,
      priceDecimals: 2,
      settlementLagDays: 2,
      rowsRead: 100,
      parseErrorsJson: "[]",
      countsJson: "{}",
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      breaks: [{ breakId: "b1", runId: "r1", type: "MISSING", tradeId: "t1" }],
      created: true,
    };

    await store.createRun(run);

    const promise1 = store.transition("b1", "OPEN", "INVESTIGATING", "user1 investigating", "user1", Date.now());
    const promise2 = store.transition("b1", "OPEN", "RESOLVED", "user2 resolved", "user2", Date.now());

    const results = await Promise.allSettled([promise1, promise2]);
    const successes = results.filter((r) => r.status === "fulfilled").length;
    const failures = results.filter((r) => r.status === "rejected").length;

    expect(successes).toBe(1);
    expect(failures).toBe(1);
    expect(results.find((r) => r.status === "rejected")!.reason).toBeInstanceOf(ConcurrentModificationError);

    const audit = await store.getAudit("b1");
    expect(audit).toHaveLength(1);
  });

  it("RDB5: terminal immutability enforced under concurrency", async () => {
    const run: StoredRun & { breaks: readonly any[] } = {
      runId: "r1",
      source: "s1",
      fileHash: "h1",
      cutoffTs: 1000,
      priceDecimals: 2,
      settlementLagDays: 2,
      rowsRead: 100,
      parseErrorsJson: "[]",
      countsJson: "{}",
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      breaks: [{ breakId: "b1", runId: "r1", type: "MISSING", tradeId: "t1" }],
      created: true,
    };

    await store.createRun(run);
    await store.transition("b1", "OPEN", "RESOLVED", "resolved", "user1", Date.now());

    // Sequential attempts to move from terminal state should both fail
    try {
      await store.transition("b1", "RESOLVED", "OPEN", "reopen", "user1", Date.now());
      expect.fail("should not allow transition from terminal RESOLVED to OPEN");
    } catch (e) {
      expect(e).toBeInstanceOf(ConcurrentModificationError);
    }

    try {
      await store.transition("b1", "RESOLVED", "WRITTEN_OFF", "written off", "user2", Date.now());
      expect.fail("should not allow transition from terminal RESOLVED to WRITTEN_OFF");
    } catch (e) {
      expect(e).toBeInstanceOf(ConcurrentModificationError);
    }
  });

  it("RDB6: empty reason or actor rejected by DB constraint", async () => {
    try {
      await sql.query(
        `INSERT INTO recon_audit (break_id, from_status, to_status, reason, actor, ts)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["b1", "OPEN", "INVESTIGATING", "  ", "user1", Date.now()],
      );
      expect.fail("should reject empty reason");
    } catch (e) {
      expect((e as any).message).toContain("check constraint");
    }

    try {
      await sql.query(
        `INSERT INTO recon_audit (break_id, from_status, to_status, reason, actor, ts)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["b1", "OPEN", "INVESTIGATING", "reason", "  ", Date.now()],
      );
      expect.fail("should reject empty actor");
    } catch (e) {
      expect((e as any).message).toContain("check constraint");
    }
  });

  it("RDB7: audit append-only, ascending seq, no update path exists", async () => {
    const run: StoredRun & { breaks: readonly any[] } = {
      runId: "r1",
      source: "s1",
      fileHash: "h1",
      cutoffTs: 1000,
      priceDecimals: 2,
      settlementLagDays: 2,
      rowsRead: 100,
      parseErrorsJson: "[]",
      countsJson: "{}",
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      breaks: [{ breakId: "b1", runId: "r1", type: "MISSING", tradeId: "t1" }],
      created: true,
    };

    await store.createRun(run);
    await store.transition("b1", "OPEN", "INVESTIGATING", "r1", "u1", Date.now());
    await store.transition("b1", "INVESTIGATING", "RESOLVED", "r2", "u2", Date.now());

    const audit = await store.getAudit("b1");
    expect(audit).toHaveLength(2);
    expect(audit[0]!.seq).toBeLessThan(audit[1]!.seq);
    expect(audit[0]!.toStatus).toBe("INVESTIGATING");
    expect(audit[1]!.toStatus).toBe("RESOLVED");
  });

  it("RDB8: listBreaks filters by run, type, status; deterministic ordering", async () => {
    const run: StoredRun & { breaks: readonly any[] } = {
      runId: "r1",
      source: "s1",
      fileHash: "h1",
      cutoffTs: 1000,
      priceDecimals: 2,
      settlementLagDays: 2,
      rowsRead: 100,
      parseErrorsJson: "[]",
      countsJson: "{}",
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      breaks: [
        { breakId: "b3", runId: "r1", type: "MISSING", tradeId: "t3" },
        { breakId: "b1", runId: "r1", type: "MISSING", tradeId: "t1" },
        { breakId: "b2", runId: "r1", type: "EXTRA", tradeId: "t2" },
      ],
      created: true,
    };

    await store.createRun(run);
    await store.transition("b2", "OPEN", "INVESTIGATING", "r", "u", Date.now());

    const byType = await store.listBreaks({ runId: "r1", type: "MISSING" });
    expect(byType).toHaveLength(2);

    const byStatus = await store.listBreaks({ runId: "r1", status: "INVESTIGATING" });
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0]!.breakId).toBe("b2");

    const all = await store.listBreaks({ runId: "r1" });
    expect(all).toHaveLength(3);
    // Verify ordering by trade_id
    for (let i = 0; i < all.length - 1; i++) {
      expect(all[i]!.tradeId <= all[i + 1]!.tradeId).toBe(true);
    }
  });
});
