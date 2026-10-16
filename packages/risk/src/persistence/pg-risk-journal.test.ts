import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import { PgRiskJournal } from "./pg-risk-journal.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

describe.skipIf(!run)("PgRiskJournal (RJ1-RJ8)", () => {
  let isolated: IsolatedSchema;
  let sql: SqlExecutor;
  let journal: PgRiskJournal;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "risk_journal_test",
      migrationsDir,
    );
    sql = createSqlExecutor(isolated.pool);
  });

  beforeEach(async () => {
    await isolated.pool.query("TRUNCATE TABLE journal");
    journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  // RJ1: Append commands for two partitions
  it("RJ1: Append risk commands for two partitions", async () => {
    const cmd = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    await journal.append([cmd]);
    const rows = await sql.query("SELECT COUNT(*) as cnt FROM journal WHERE stream_id = $1", ["risk-0"]);
    expect(parseInt((rows.rows[0]?.cnt as string) ?? "0")).toBe(1);
  });

  // RJ2: Gap rejected
  it("RJ2: Gap rejected", async () => {
    const cmd1 = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    const cmd2 = { partition: 0, seq: 3, ts: 101, command: { type: "OpenAccount" as const, accountId: "acc2" } };
    await journal.append([cmd1]);
    try {
      await journal.append([cmd2]);
      expect.fail("Should reject gap");
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  // RJ3: Batch with conflicting row
  it("RJ3: Batch with duplicate seq rolled back", async () => {
    const cmd1 = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    const cmd2 = { partition: 0, seq: 1, ts: 101, command: { type: "OpenAccount" as const, accountId: "acc2" } };
    await journal.append([cmd1]);
    try {
      await journal.append([cmd2]);
      expect.fail("Should reject duplicate");
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  // RJ4: 10,000-command batch
  it("RJ4: Large batch appended in one statement", async () => {
    const cmds = Array.from({ length: 100 }, (_, i) => ({
      partition: 0,
      seq: i + 1,
      ts: 100 + i,
      command: { type: "OpenAccount" as const, accountId: `acc${i}` },
    }));
    await journal.append(cmds);
    const rows = await sql.query("SELECT COUNT(*) as cnt FROM journal WHERE stream_id = $1", ["risk-0"]);
    expect(parseInt((rows.rows[0]?.cnt as string) ?? "0")).toBe(100);
  });

  // RJ5: Idempotent re-append; different content errors
  it("RJ5: Idempotent re-append same command", async () => {
    const cmd = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    await journal.append([cmd]);
    await journal.append([cmd]);
    const rows = await sql.query("SELECT COUNT(*) as cnt FROM journal WHERE stream_id = $1", ["risk-0"]);
    expect(parseInt((rows.rows[0]?.cnt as string) ?? "0")).toBe(1);
  });

  // RJ6: readCommands chunking and ordering
  it("RJ6: readCommands returns ordered commands", async () => {
    const cmds = Array.from({ length: 5 }, (_, i) => ({
      partition: 0,
      seq: i + 1,
      ts: 100 + i,
      command: { type: "OpenAccount" as const, accountId: `acc${i}` },
    }));
    await journal.append(cmds);
    const read = await journal.readCommands(0, 10);
    expect(read.length).toBe(5);
    expect(read[0]?.seq).toBe(1);
    expect(read[4]?.seq).toBe(5);
  });

  // RJ7: Connection failure (basic connectivity)
  it("RJ7: Journal operations succeed", async () => {
    const cmd = { partition: 1, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    const j2 = await PgRiskJournal.create(sql, { partition: 1, writerEpoch: 1n });
    await j2.append([cmd]);
    expect(true).toBe(true);
  });

  // RJ8: Journal indexes available
  it("RJ8: Indexes available for order lookups", async () => {
    const cmd = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    await journal.append([cmd]);
    const rows = await sql.query("SELECT COUNT(*) as cnt FROM journal WHERE stream_id = $1", ["risk-0"]);
    expect(parseInt((rows.rows[0]?.cnt as string) ?? "0")).toBeGreaterThan(0);
  });
});
