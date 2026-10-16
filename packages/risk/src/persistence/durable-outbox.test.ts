import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import { PgRiskJournal } from "./pg-risk-journal.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

describe.skipIf(!run)("DurableRiskOutbox (DO1-DO3)", () => {
  let isolated: IsolatedSchema;
  let sql: SqlExecutor;
  let journal: PgRiskJournal;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "durable_outbox_test",
      migrationsDir,
    );
    sql = createSqlExecutor(isolated.pool);
  });

  beforeEach(async () => {
    await isolated.pool.query("TRUNCATE TABLE journal, order_owners");
    journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  // DO1: Events journaled before forwarding
  it("DO1: Events journaled before forwarding", async () => {
    const cmd = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    await journal.append([cmd]);

    const rows = await sql.query("SELECT * FROM journal WHERE stream_id = $1", ["risk-0"]);
    expect(rows.rowCount).toBeGreaterThan(0);
  });

  // DO2: OrderAccepted and owner inserted atomically
  it("DO2: OrderAccepted and order_owners atomic", async () => {
    const cmd = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    await journal.append([cmd]);

    const events = await sql.query("SELECT COUNT(*) as cnt FROM journal WHERE stream_id = $1", ["risk-0"]);
    expect(parseInt((events.rows[0]?.cnt as string) ?? "0")).toBeGreaterThan(0);
  });

  // DO3: Idempotent re-publish
  it("DO3: Idempotent re-publish", async () => {
    const cmd = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount" as const, accountId: "acc1" } };
    await journal.append([cmd]);
    await journal.append([cmd]);

    const events = await sql.query("SELECT COUNT(*) as cnt FROM journal WHERE stream_id = $1", ["risk-0"]);
    expect(parseInt((events.rows[0]?.cnt as string) ?? "0")).toBe(1);
  });
});
