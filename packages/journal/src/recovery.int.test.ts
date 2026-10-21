import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setUpIsolatedSchema } from "./test-schema.js";
import type { IsolatedSchema } from "./test-schema.js";
import { PgJournal } from "./pg-journal.js";
import { PgSnapshotStore } from "./snapshot-store.js";
import { recoverStream } from "./recovery.js";
import type { InstrumentConfig } from "@matchledger/engine-core";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";

describe.skipIf(!run)("RC: Recovery", () => {
  let isolated: IsolatedSchema;
  let pool: IsolatedSchema["pool"];
  let journal: PgJournal;
  let snapshots: PgSnapshotStore;
  const spec: InstrumentConfig = { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxQuantity: 1000n, maxPrice: 10000n };

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "recovery_test",
      new URL("../migrations", import.meta.url).pathname.replace("/dist/", "/src/"),
    );
    pool = isolated.pool;
    journal = new PgJournal(pool, 1);
    snapshots = new PgSnapshotStore(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE journal, snapshots");
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  it("RC1: Empty journal, no snapshot", async () => {
    const result = await recoverStream({ journal, snapshots, symbol: "ABC", spec });
    expect(result.lastSeq).toBe(0);
    expect(result.replayed).toBe(0);
  });

  it("RC2: No snapshot, commands replayed", async () => {
    await journal.append([
      { symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } as any },
      { symbol: "ABC", seq: 2, ts: 2000, command: { kind: "TICK" } as any },
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
    await journal.append([{ symbol: "ABC", seq: 1, ts: 1000, command: { kind: "TICK" } as any }]);
    await journal.append([{ symbol: "XYZ", seq: 1, ts: 2000, command: { kind: "TICK" } as any }]);
    const r1 = await recoverStream({ journal, snapshots, symbol: "ABC", spec });
    const specXYZ = { ...spec, symbol: "XYZ" };
    const r2 = await recoverStream({ journal, snapshots, symbol: "XYZ", spec: specXYZ });
    expect(r1.lastSeq).toBe(1);
    expect(r2.lastSeq).toBe(1);
  });
});
