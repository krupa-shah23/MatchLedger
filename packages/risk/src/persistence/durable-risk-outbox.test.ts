import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import type { RiskOutbox, RiskOutput } from "@matchledger/common";
import { PgRiskJournal } from "./pg-risk-journal.js";
import { DurableRiskOutbox } from "./durable-risk-outbox.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

class SpyDownstream implements RiskOutbox {
  calls: { partition: number; outputs: readonly RiskOutput[] }[] = [];
  shouldThrow = false;

  async publish(partition: number, outputs: readonly RiskOutput[]): Promise<void> {
    if (this.shouldThrow) throw new Error("downstream failure");
    this.calls.push({ partition, outputs });
  }
}

describe.skipIf(!run)("DurableRiskOutbox (DO1-DO3)", () => {
  let isolated: IsolatedSchema;
  let pool: IsolatedSchema["pool"];
  let sql: SqlExecutor;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "risk_outbox_test",
      migrationsDir,
    );
    pool = isolated.pool;
    sql = createSqlExecutor(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE journal, order_owners");
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  function output(seq: number): RiskOutput {
    return {
      partition: 0,
      seq,
      ts: seq,
      command: { type: "OpenAccount", accountId: `A${seq}` },
      events: [{ type: "AccountOpened", accountId: `A${seq}` }],
    };
  }

  // DO1: events journaled BEFORE forwarding; journal failure -> downstream not called
  it("DO1: events are journaled before the downstream call; downstream is skipped if journaling fails", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const downstream = new SpyDownstream();
    const outbox = new DurableRiskOutbox(journal, downstream);

    const callOrder: string[] = [];
    const journalSpy = { appendEvents: journal.appendEvents.bind(journal) };
    const originalAppend = journalSpy.appendEvents;
    (journal as any).appendEvents = async (outputs: readonly RiskOutput[]) => {
      callOrder.push("journal");
      return originalAppend(outputs);
    };
    const originalPublish = downstream.publish.bind(downstream);
    downstream.publish = async (partition: number, outputs: readonly RiskOutput[]) => {
      callOrder.push("downstream");
      return originalPublish(partition, outputs);
    };

    await outbox.publish(0, [output(1)]);
    expect(callOrder).toEqual(["journal", "downstream"]);

    const rows = await pool.query("SELECT 1 FROM journal WHERE stream_id = 'risk-0' AND record_type = 'EVENT'");
    expect(rows.rows).toHaveLength(1);
    expect(downstream.calls).toHaveLength(1);

    // Now force journaling to fail (bad DB target) - downstream must not be called
    const brokenJournal = await PgRiskJournal.create(
      { query: () => Promise.reject(new Error("db down")), transaction: (fn: any) => fn({ query: () => Promise.reject(new Error("db down")) }) } as any,
      { partition: 1, writerEpoch: 1n },
    );
    const downstream2 = new SpyDownstream();
    const outbox2 = new DurableRiskOutbox(brokenJournal, downstream2);
    await expect(outbox2.publish(1, [output(1)])).rejects.toThrow();
    expect(downstream2.calls).toHaveLength(0);
  });

  // DO2: OrderAccepted inserts order_owners atomically with the event; conflicting event/owner rolls back both
  it("DO2: OrderAccepted inserts order_owners in the same transaction as the event rows", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const downstream = new SpyDownstream();
    const outbox = new DurableRiskOutbox(journal, downstream);

    const accepted: RiskOutput = {
      partition: 0,
      seq: 1,
      ts: 1,
      command: { type: "SubmitOrder", orderId: "o1", accountId: "A", symbol: "ACME", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 1n, price: 1n, market: {} },
      events: [{ type: "OrderAccepted", orderId: "o1", accountId: "A", symbol: "ACME", side: "BUY", timeInForce: "GTC", price: 1n, quantity: 1n }],
    };
    await outbox.publish(0, [accepted]);

    const ownerRows = await pool.query("SELECT account_id, symbol, side FROM order_owners WHERE order_id = 'o1'");
    expect(ownerRows.rows).toHaveLength(1);
    expect((ownerRows.rows[0] as any).account_id).toBe("A");

    // Now force a conflicting owner for the SAME order id with a DIFFERENT account,
    // via a DIFFERENT seq's event (so the event row insert itself doesn't conflict,
    // only order_owners should) -> the event row for THIS call must not persist either.
    const conflicting: RiskOutput = {
      partition: 0,
      seq: 2,
      ts: 2,
      command: { type: "SubmitOrder", orderId: "o1", accountId: "B", symbol: "ACME", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 1n, price: 1n, market: {} },
      events: [{ type: "OrderAccepted", orderId: "o1", accountId: "B", symbol: "ACME", side: "BUY", timeInForce: "GTC", price: 1n, quantity: 1n }],
    };
    await expect(outbox.publish(0, [conflicting])).rejects.toThrow();

    const eventRowsAtSeq2 = await pool.query("SELECT 1 FROM journal WHERE stream_id = 'risk-0' AND record_type = 'EVENT' AND seq = 2");
    expect(eventRowsAtSeq2.rows).toHaveLength(0); // rolled back together with the owner conflict

    const ownerStillOriginal = await pool.query("SELECT account_id FROM order_owners WHERE order_id = 'o1'");
    expect((ownerStillOriginal.rows[0] as any).account_id).toBe("A"); // unchanged
  });

  // DO3: idempotent re-publish leaves one set of event rows and one owner row
  it("DO3: re-publishing the same outputs twice is idempotent", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const downstream = new SpyDownstream();
    const outbox = new DurableRiskOutbox(journal, downstream);

    const accepted: RiskOutput = {
      partition: 0,
      seq: 1,
      ts: 1,
      command: { type: "SubmitOrder", orderId: "o1", accountId: "A", symbol: "ACME", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 1n, price: 1n, market: {} },
      events: [{ type: "OrderAccepted", orderId: "o1", accountId: "A", symbol: "ACME", side: "BUY", timeInForce: "GTC", price: 1n, quantity: 1n }],
    };

    await outbox.publish(0, [accepted]);
    await outbox.publish(0, [accepted]);

    const eventRows = await pool.query("SELECT 1 FROM journal WHERE stream_id = 'risk-0' AND record_type = 'EVENT'");
    expect(eventRows.rows).toHaveLength(1);
    const ownerRows = await pool.query("SELECT 1 FROM order_owners WHERE order_id = 'o1'");
    expect(ownerRows.rows).toHaveLength(1);
    expect(downstream.calls).toHaveLength(2); // downstream is still called each time; durability is idempotent, delivery is at-least-once
  });
});
