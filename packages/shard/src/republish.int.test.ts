import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPool } from "@matchledger/journal";
import { runMigrations } from "@matchledger/journal";
import { createSqlExecutor } from "@matchledger/journal";
import { republish } from "./republish.js";
import type { Pool } from "pg";
import type { EventSink } from "@matchledger/common";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";

describe.skipIf(!run)("KC: Crash Windows (Republish)", () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = createPool({
      connectionString:
        process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
    });
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await runMigrations(
      pool,
      new URL("../../../journal/migrations", import.meta.url).pathname.replace("/dist/", "/src/")
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("KC5: Republish events after journal commit, before Kafka commit", async () => {
    const leaseId = "shard-0";
    const symbol = "AAPL";

    // Set up lease
    await pool.query(
      "INSERT INTO shard_leases (lease_id, owner, epoch) VALUES ($1, $2, $3)",
      [leaseId, "instance-1", 1n]
    );

    // Simulate: events journaled with seq 41-44, but published_through is 40
    const sql = createSqlExecutor(pool);
    await sql.transaction(async (tx) => {
      // Insert event rows
      for (let seq = 41; seq <= 44; seq++) {
        await tx.query(
          `INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json)
           VALUES ($1, $2, 'EVENT', 0, 1, now(), 1, $3)`,
          [symbol, seq, JSON.stringify({ symbol, seq, events: [`event${seq}`] })]
        );
      }

      // published_through is 40
      await tx.query(
        "INSERT INTO published_through (lease_id, symbol, seq) VALUES ($1, $2, $3)",
        [leaseId, symbol, 40n]
      );
    });

    // Mock EventSink to collect published events
    const publishedEvents: any[] = [];
    const mockSink: EventSink = {
      publish: async (batch) => {
        publishedEvents.push(...batch);
      },
    };

    // Republish
    await republish(pool, mockSink, [symbol], leaseId);

    // Should have republished events 41-44
    expect(publishedEvents).toHaveLength(4);
    expect(publishedEvents[0].seq).toBe(41n);
    expect(publishedEvents[3].seq).toBe(44n);
  });

  it("KC7: Republish same events again (duplicates on topic, consumer dedupes by symbol:seq)", async () => {
    const leaseId = "shard-0";
    const symbol = "AAPL";

    // Set up lease
    await pool.query(
      "INSERT INTO shard_leases (lease_id, owner, epoch) VALUES ($1, $2, $3)",
      [leaseId, "instance-1", 1n]
    );

    // Events 41-44 journaled; published_through is 40 initially
    const sql = createSqlExecutor(pool);
    await sql.transaction(async (tx) => {
      for (let seq = 41; seq <= 44; seq++) {
        await tx.query(
          `INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json)
           VALUES ($1, $2, 'EVENT', 0, 1, now(), 1, $3)`,
          [symbol, seq, JSON.stringify({ symbol, seq })]
        );
      }
      await tx.query(
        "INSERT INTO published_through (lease_id, symbol, seq) VALUES ($1, $2, $3)",
        [leaseId, symbol, 40n]
      );
    });

    const publishedEvents: any[] = [];
    const mockSink: EventSink = {
      publish: async (batch) => {
        publishedEvents.push(...batch);
      },
    };

    // First republish
    await republish(pool, mockSink, [symbol], leaseId);
    expect(publishedEvents).toHaveLength(4); // 41-44

    publishedEvents.length = 0; // Reset

    // Simulate: published_through updated to 44 (events committed to Kafka)
    await pool.query(
      "UPDATE published_through SET seq = $1 WHERE lease_id = $2 AND symbol = $3",
      [44n, leaseId, symbol]
    );

    // Second republish should find no events (all are <= published_through)
    await republish(pool, mockSink, [symbol], leaseId);
    expect(publishedEvents).toHaveLength(0);
  });

  it("TR7: Transactional republish maintains all-or-nothing semantics", async () => {
    const leaseId = "shard-0";
    const symbol = "AAPL";

    await pool.query(
      "INSERT INTO shard_leases (lease_id, owner, epoch) VALUES ($1, $2, $3)",
      [leaseId, "instance-1", 1n]
    );

    const sql = createSqlExecutor(pool);
    await sql.transaction(async (tx) => {
      for (let seq = 1; seq <= 3; seq++) {
        await tx.query(
          `INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json)
           VALUES ($1, $2, 'EVENT', 0, 1, now(), 1, $3)`,
          [symbol, seq, JSON.stringify({ symbol, seq })]
        );
      }
      await tx.query(
        "INSERT INTO published_through (lease_id, symbol, seq) VALUES ($1, $2, $3)",
        [leaseId, symbol, 0n]
      );
    });

    let callCount = 0;
    const mockSink: EventSink = {
      publish: async (batch) => {
        callCount++;
        // First call succeeds, any subsequent calls should not happen (single batch)
        if (callCount > 1) {
          throw new Error("Multiple publish calls not expected");
        }
      },
    };

    await republish(pool, mockSink, [symbol], leaseId);
    expect(callCount).toBe(1); // Exactly one publish call for all 3 events
  });
});
