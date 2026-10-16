 
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { PgJournal } from "./pg-journal.js";
import { PgSnapshotStore } from "./snapshot-store.js";
import { recoverStream } from "./recovery.js";
const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
describe.skipIf(!run)("RC: Recovery", () => {
    let pool;
    let journal;
    let snapshots;
    const spec = { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxQuantity: 1000n, maxPrice: 10000n };
    beforeEach(async () => {
        pool = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
        await pool.query("DROP TABLE IF EXISTS schema_migrations CASCADE");
        await pool.query("DROP TABLE IF EXISTS journal CASCADE");
        await pool.query("DROP TABLE IF EXISTS snapshots CASCADE");
        await runMigrations(pool, new URL("../migrations", import.meta.url).pathname.replace("/dist/", "/src/"));
        journal = new PgJournal(pool, 1);
        snapshots = new PgSnapshotStore(pool);
    });
    it("RC1: Empty journal, no snapshot", async () => {
        const result = await recoverStream({ journal, snapshots, symbol: "ABC", spec });
        expect(result.lastSeq).toBe(0);
        expect(result.replayed).toBe(0);
    });
    it("RC2: No snapshot, commands replayed", async () => {
        await journal.append([
            { symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } },
            { symbol: "ABC", seq: 2, ts: 2000, command: { kind: "TICK" } },
        ]);
        const result = await recoverStream({ journal, snapshots, symbol: "ABC", spec });
        expect(result.lastSeq).toBe(2);
        expect(result.replayed).toBe(2);
    });
    it("RC9: Snapshot that fails restore is ignored", async () => {
        const result = await recoverStream({ journal, snapshots, symbol: "ABC", spec });
        expect(result.lastSeq).toBe(0);
    });
    it("RC10: Multi-symbol each recovered", async () => {
        await journal.append([{ symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } }]);
        await journal.append([{ symbol: "XYZ", seq: 1, ts: 2000, command: { kind: "TICK" } }]);
        const r1 = await recoverStream({ journal, snapshots, symbol: "ABC", spec });
        const specXYZ = { ...spec, symbol: "XYZ" };
        const r2 = await recoverStream({ journal, snapshots, symbol: "XYZ", spec: specXYZ });
        expect(r1.lastSeq).toBe(1);
        expect(r2.lastSeq).toBe(1);
    });
    afterEach(async () => {
        await pool.end();
    });
});
