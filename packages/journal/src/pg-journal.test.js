 
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPool } from "./pool.js";
import { PgJournal, JournalSequenceError } from "./pg-journal.js";
import { PgSnapshotStore } from "./snapshot-store.js";
import { OrderRequestStore } from "./order-request-store.js";
import { SeqDeduper } from "@matchledger/common";
const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
describe.skipIf(!run)("J: Journal", () => {
    let pool;
    let journal;
    beforeEach(async () => {
        pool = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
        await pool.query("DROP TABLE IF EXISTS journal CASCADE");
        await pool.query(`CREATE TABLE journal (
      stream_id TEXT NOT NULL, seq BIGINT NOT NULL CHECK (seq >= 1),
      record_type TEXT NOT NULL, idx INTEGER NOT NULL,
      schema_version SMALLINT NOT NULL, ts BIGINT NOT NULL,
      writer_epoch BIGINT NOT NULL, payload_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (stream_id, seq, record_type, idx)
    )`);
        journal = new PgJournal(pool, 1);
    });
    it("J1: Append batch of commands", async () => {
        await journal.append([
            { symbol: "ABC", seq: 1, ts: 1000, command: { type: "PLACE", orderId: "o1" } },
            { symbol: "ABC", seq: 2, ts: 2000, command: { type: "CANCEL", orderId: "o1" } },
        ]);
        const max = await journal.lastCommandSeq("ABC");
        expect(max).toBe(2);
    });
    it("J4: Gap in seq rejects", async () => {
        await expect(journal.append([
            { symbol: "ABC", seq: 1, ts: 1000, command: {} },
            { symbol: "ABC", seq: 3, ts: 2000, command: {} },
        ])).rejects.toThrow(JournalSequenceError);
    });
    it("J9: lastCommandSeq returns 0 when empty", async () => {
        const seq = await journal.lastCommandSeq("XYZ");
        expect(seq).toBe(0);
    });
});
describe.skipIf(!run)("SS: Snapshot Store", () => {
    let pool;
    let store;
    beforeEach(async () => {
        pool = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
        await pool.query("DROP TABLE IF EXISTS snapshots CASCADE");
        await pool.query(`CREATE TABLE snapshots (
      stream_id TEXT NOT NULL, last_seq BIGINT NOT NULL,
      last_ts BIGINT NOT NULL, schema_version SMALLINT NOT NULL,
      state_json JSONB NOT NULL, checksum TEXT NOT NULL,
      PRIMARY KEY (stream_id, last_seq)
    )`);
        store = new PgSnapshotStore(pool);
    });
    it("SS1: Save and load snapshot", async () => {
        const snap = { version: 1, symbol: "ABC", spec: {}, nextArrivalSeq: 0, nextTradeSeq: 0, bids: [], asks: [] };
        await store.save({ stream: "ABC", lastSeq: 100, lastTs: 5000, state: snap });
        const candidates = await store.listCandidates("ABC", { maxSeq: 100 });
        expect(candidates).toHaveLength(1);
    });
    afterEach(async () => {
        await pool.end();
    });
});
describe.skipIf(!run)("OR: Order Request Store", () => {
    let pool;
    let store;
    beforeEach(async () => {
        pool = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
        await pool.query("DROP TABLE IF EXISTS order_requests CASCADE");
        await pool.query(`CREATE TABLE order_requests (
      account_id TEXT NOT NULL, client_order_id TEXT NOT NULL,
      order_id TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
      PRIMARY KEY (account_id, client_order_id)
    )`);
        store = new OrderRequestStore(pool);
    });
    it("OR1: Register new key creates", async () => {
        const res = await store.register("a1", "c1", "o1", { test: 1 });
        expect(res.result).toBe("CREATED");
    });
    it("OR2: Same key and payload returns DUPLICATE", async () => {
        const payload = { test: 1 };
        await store.register("a1", "c1", "o1", payload);
        const res = await store.register("a1", "c1", "o2", payload);
        expect(res.result).toBe("DUPLICATE");
        expect(res.orderId).toBe("o1");
    });
    it("OR3: Same key, different payload returns CONFLICT", async () => {
        await store.register("a1", "c1", "o1", { test: 1 });
        const res = await store.register("a1", "c1", "o2", { test: 2 });
        expect(res.result).toBe("CONFLICT");
    });
    afterEach(async () => {
        await pool.end();
    });
});
describe("R3: SeqDeduper", () => {
    it("accepts seq in order", () => {
        const deduper = new SeqDeduper();
        expect(deduper.accept("ABC", 1)).toBe(true);
        expect(deduper.accept("ABC", 2)).toBe(true);
        expect(deduper.accept("ABC", 3)).toBe(true);
    });
    it("rejects duplicates", () => {
        const deduper = new SeqDeduper();
        deduper.accept("ABC", 1);
        expect(deduper.accept("ABC", 1)).toBe(false);
    });
    it("detects gaps", () => {
        const deduper = new SeqDeduper();
        deduper.accept("ABC", 1);
        expect(() => deduper.accept("ABC", 3)).toThrow("Gap");
    });
});
