import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import type { RiskConfig, StampedRiskCommand } from "@matchledger/common";
import { serializeRiskState } from "@matchledger/common";
import { recoverRiskPartition } from "./recover-risk-partition.js";
import { RiskCore } from "../core/risk-core.js";
import { PgRiskJournal } from "../persistence/pg-risk-journal.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

const config: RiskConfig = {
  instruments: new Map([["TEST", { symbol: "TEST", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60000 }]]),
};

describe.skipIf(!run)("recoverRiskPartition (RR1-RR12)", () => {
  let isolated: IsolatedSchema;
  let pool: IsolatedSchema["pool"];
  let sql: SqlExecutor;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "risk_recovery_test",
      migrationsDir,
    );
    pool = isolated.pool;
    sql = createSqlExecutor(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE journal, order_owners, snapshots");
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  it("RR1: recover an empty partition into a fresh, healthy risk core", async () => {
    const result = await recoverRiskPartition({ sql, partition: 0, config });
    expect(result.core).toBeDefined();
    expect(result.lastSeq).toBe(0);
    expect(result.replayed).toBe(0);
    expect(result.verified).toBe(0);
    expect(result.regenerated).toHaveLength(0);
    expect(result.snapshotUsed).toBeUndefined();
    expect(result.invalidSnapshots).toHaveLength(0);
  });

  it("RR2: preserve the correct partition number during recovery", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 5, writerEpoch: 1n });
    const cmd: StampedRiskCommand = {
      partition: 5,
      seq: 1,
      ts: 100,
      command: { type: "OpenAccount", accountId: "acc1" },
    };
    await journal.append([cmd]);

    const result = await recoverRiskPartition({ sql, partition: 5, config });
    expect(result.partition).toBe(5);
    expect(result.lastSeq).toBe(1);
    expect(result.replayed).toBe(1);
  });

  it("RR3: replay a single command after recovery without changing behavior", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmd: StampedRiskCommand = {
      partition: 0,
      seq: 1,
      ts: 100,
      command: { type: "OpenAccount", accountId: "acc1" },
    };
    await journal.append([cmd]);

    const result = await recoverRiskPartition({ sql, partition: 0, config });
    expect(result.replayed).toBe(1);
    expect(result.lastSeq).toBe(1);

    const freshCore = new RiskCore(config);
    freshCore.apply(cmd);
    expect(result.core.exportState()).toEqual(freshCore.exportState());
  });

  it("RR4: replay multiple commands in sequence with the same final state", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmds: StampedRiskCommand[] = [
      { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount", accountId: "acc1" } },
      { partition: 0, seq: 2, ts: 200, command: { type: "OpenAccount", accountId: "acc2" } },
      { partition: 0, seq: 3, ts: 300, command: { type: "Deposit", accountId: "acc1", asset: "CASH", amount: 1000n, requestId: "d1" } },
    ];
    await journal.append(cmds);

    const result = await recoverRiskPartition({ sql, partition: 0, config });
    expect(result.replayed).toBe(3);

    const freshCore = new RiskCore(config);
    cmds.forEach((c) => freshCore.apply(c));
    expect(result.core.exportState()).toEqual(freshCore.exportState());
  });

  it("RR5: load and reuse the newest valid snapshot when present", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmd: StampedRiskCommand = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount", accountId: "acc1" } };
    await journal.append([cmd]);

    const core = new RiskCore(config);
    core.apply(cmd);
    const state1 = core.exportState();
    const stateJson = serializeRiskState(state1);
    const checksum = createHash("sha256").update(stateJson).digest("hex");

    await sql.query("INSERT INTO snapshots (stream_id, last_seq, last_ts, schema_version, state_json, checksum) VALUES ($1, $2, $3, $4, $5::jsonb, $6)", [
      `risk-snapshot-0`,
      1,
      100,
      1,
      stateJson,
      checksum,
    ]);

    const result = await recoverRiskPartition({ sql, partition: 0, config });
    expect(result.snapshotUsed?.lastSeq).toBe(1);
    expect(result.replayed).toBe(0);
  });

  it("RR6: replay only the commands after the snapshot and rebuild the tail", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmd1: StampedRiskCommand = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount", accountId: "acc1" } };
    const cmd2: StampedRiskCommand = { partition: 0, seq: 2, ts: 200, command: { type: "OpenAccount", accountId: "acc2" } };
    await journal.append([cmd1, cmd2]);

    const core = new RiskCore(config);
    core.apply(cmd1);
    const state1 = core.exportState();
    const stateJson = serializeRiskState(state1);
    const checksum = createHash("sha256").update(stateJson).digest("hex");

    await sql.query("INSERT INTO snapshots (stream_id, last_seq, last_ts, schema_version, state_json, checksum) VALUES ($1, $2, $3, $4, $5::jsonb, $6)", [
      `risk-snapshot-0`,
      1,
      100,
      1,
      stateJson,
      checksum,
    ]);

    const result = await recoverRiskPartition({ sql, partition: 0, config });
    expect(result.snapshotUsed?.lastSeq).toBe(1);
    expect(result.replayed).toBe(1);
    expect(result.lastSeq).toBe(2);
  });

  it("RR7: reject any recovered state that violates risk invariants", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmd1: StampedRiskCommand = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount", accountId: "acc1" } };
    await journal.append([cmd1]);

    const core = new RiskCore(config);
    core.apply(cmd1);
    let state = core.exportState();

    state = { ...state, accounts: [{ ...state.accounts[0]!, cash: -1n }] };
    const stateJson = serializeRiskState(state);
    const checksum = createHash("sha256").update(stateJson).digest("hex");

    await sql.query("INSERT INTO snapshots (stream_id, last_seq, last_ts, schema_version, state_json, checksum) VALUES ($1, $2, $3, $4, $5::jsonb, $6)", [
      `risk-snapshot-0`,
      1,
      100,
      1,
      stateJson,
      checksum,
    ]);

    const result = await recoverRiskPartition({ sql, partition: 0, config });
    expect(result.invalidSnapshots).toHaveLength(1);
    expect(result.invalidSnapshots[0]!.reason).toContain("NEGATIVE");
  });

  it("RR8: recover each partition independently without cross-partition leakage", async () => {
    const j0 = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const j1 = await PgRiskJournal.create(sql, { partition: 1, writerEpoch: 1n });

    const cmd0: StampedRiskCommand = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount", accountId: "acc1" } };
    const cmd1: StampedRiskCommand = { partition: 1, seq: 1, ts: 100, command: { type: "OpenAccount", accountId: "acc2" } };
    await j0.append([cmd0]);
    await j1.append([cmd1]);

    const r0 = await recoverRiskPartition({ sql, partition: 0, config });
    const r1 = await recoverRiskPartition({ sql, partition: 1, config });

    expect(r0.partition).toBe(0);
    expect(r1.partition).toBe(1);
    expect(r0.lastSeq).toBe(1);
    expect(r1.lastSeq).toBe(1);
  });

  it("RR9: handle an empty command list without altering state", async () => {
    await recoverRiskPartition({ sql, partition: 0, config });
    const result = await recoverRiskPartition({ sql, partition: 0, config });

    expect(result.replayed).toBe(0);
    expect(result.lastSeq).toBe(0);
  });

  it("RR10: preserve commandLog order across replay", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmds: StampedRiskCommand[] = [
      { partition: 0, seq: 1, ts: 100, command: { type: "HaltSymbol", symbol: "TEST" } },
      { partition: 0, seq: 2, ts: 200, command: { type: "ResumeSymbol", symbol: "TEST" } },
      { partition: 0, seq: 3, ts: 300, command: { type: "HaltSymbol", symbol: "TEST" } },
    ];
    await journal.append(cmds);

    const result = await recoverRiskPartition({ sql, partition: 0, config });
    const state = result.core.exportState();
    expect(state.haltedSymbols).toContain("TEST");
  });

  it("RR11: throw InvalidRiskStateError on config mismatch during restore", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmd1: StampedRiskCommand = { partition: 0, seq: 1, ts: 100, command: { type: "OpenAccount", accountId: "acc1" } };
    await journal.append([cmd1]);

    const core = new RiskCore(config);
    core.apply(cmd1);
    const state1 = core.exportState();
    const stateJson = serializeRiskState(state1);
    const checksum = createHash("sha256").update(stateJson).digest("hex");

    await sql.query("INSERT INTO snapshots (stream_id, last_seq, last_ts, schema_version, state_json, checksum) VALUES ($1, $2, $3, $4, $5::jsonb, $6)", [
      `risk-snapshot-0`,
      1,
      100,
      1,
      stateJson,
      checksum,
    ]);

    const wrongConfig: RiskConfig = {
      instruments: new Map([["WRONG", { symbol: "WRONG", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60000 }]]),
    };

    const result = await recoverRiskPartition({ sql, partition: 0, config: wrongConfig });
    expect(result.invalidSnapshots).toHaveLength(1);
  });

  it("RR12: preserve haltedSymbols across recovery", async () => {
    const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
    const cmd1: StampedRiskCommand = { partition: 0, seq: 1, ts: 100, command: { type: "HaltSymbol", symbol: "TEST" } };
    const cmd2: StampedRiskCommand = { partition: 0, seq: 2, ts: 200, command: { type: "OpenAccount", accountId: "acc1" } };
    await journal.append([cmd1, cmd2]);

    const result = await recoverRiskPartition({ sql, partition: 0, config });
    expect(result.core.exportState().haltedSymbols).toContain("TEST");
    expect(result.replayed).toBe(2);
  });
});
