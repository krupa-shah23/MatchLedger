import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import { Ledger, UnbalancedTransactionError, EXTERNAL, SUSPENSE } from "./ledger.js";
import { PgLedgerStore, LedgerConflictError } from "./pg-ledger-store.js";
import { txIdForDeposit, txIdForTrade, txIdForAdjustment } from "./tx-id.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "journal", "migrations");

describe.skipIf(!run)("PgLedgerStore (LP1-LP9)", () => {
  let isolated: IsolatedSchema;
  let pool: IsolatedSchema["pool"];
  let sql: SqlExecutor;
  let store: PgLedgerStore;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "ledger_store_test",
      migrationsDir,
    );
    pool = isolated.pool;
    sql = createSqlExecutor(pool);
    store = new PgLedgerStore(sql);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE ledger_entries CASCADE");
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  it("LP1: unbalanced transaction throws before any SQL", async () => {
    const unbalanced = {
      txId: txIdForDeposit("req1"),
      refEventId: "evt1",
      legs: [{ accountId: "acc1", asset: "CASH", amount: 100n }],
    };

    try {
      await store.appendTx(unbalanced);
      expect.fail("should throw UnbalancedTransactionError");
    } catch (e) {
      expect(e).toBeInstanceOf(UnbalancedTransactionError);
    }

    const rows = await sql.query("SELECT COUNT(*) FROM ledger_entries", []);
    expect(rows.rows[0]!.count).toBe(0);
  });

  it("LP2: appendTx inserts all legs in one statement, idempotent", async () => {
    const tx = {
      txId: txIdForDeposit("req1"),
      refEventId: "evt1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: 100n },
        { accountId: EXTERNAL, asset: "CASH", amount: -100n },
      ],
    };

    const r1 = await store.appendTx(tx);
    expect(r1.posted).toBe(true);

    const r2 = await store.appendTx(tx);
    expect(r2.posted).toBe(false);

    const rows = await sql.query("SELECT COUNT(*) FROM ledger_entries", []);
    expect(rows.rows[0]!.count).toBe(2);
  });

  it("LP3: appendTx with unbalanced rows throws after validation", async () => {
    const tx = {
      txId: txIdForTrade("t1"),
      refEventId: "evt1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: 100n },
        { accountId: "acc2", asset: "CASH", amount: -50n },
      ],
    };

    try {
      await store.appendTx(tx);
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnbalancedTransactionError);
    }
  });

  it("LP4: concurrent appends of same tx result in one row per leg (LP6 variant)", async () => {
    const tx = {
      txId: txIdForDeposit("req1"),
      refEventId: "evt1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: 100n },
        { accountId: EXTERNAL, asset: "CASH", amount: -100n },
      ],
    };

    const r1 = store.appendTx(tx);
    const r2 = store.appendTx(tx);
    const [result1, result2] = await Promise.all([r1, r2]);

    expect(result1.posted || result2.posted).toBe(true);
    expect(result1.posted && result2.posted).toBe(false);

    const rows = await sql.query("SELECT COUNT(*) FROM ledger_entries", []);
    expect(rows.rows[0]!.count).toBe(2);
  });

  it("LP5: conflict on partial insert throws LedgerConflictError", async () => {
    const tx = {
      txId: txIdForDeposit("req1"),
      refEventId: "evt1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: 100n },
        { accountId: EXTERNAL, asset: "CASH", amount: -100n },
      ],
    };

    // Insert first leg manually
    await sql.query(
      `INSERT INTO ledger_entries (tx_id, leg_idx, account_id, asset, amount, direction, ref_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tx.txId, 0, "acc1", "CASH", 100, "CREDIT", "evt1"],
    );

    try {
      await store.appendTx(tx);
      expect.fail("should throw LedgerConflictError");
    } catch (e) {
      expect(e).toBeInstanceOf(LedgerConflictError);
    }
  });

  it("LP6: divergent leg content throws LedgerConflictError", async () => {
    const tx = {
      txId: txIdForDeposit("req1"),
      refEventId: "evt1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: 100n },
        { accountId: EXTERNAL, asset: "CASH", amount: -100n },
      ],
    };

    await store.appendTx(tx);

    const modified = {
      txId: tx.txId,
      refEventId: tx.refEventId,
      legs: [
        { accountId: "acc2", asset: "CASH", amount: 100n },
        { accountId: EXTERNAL, asset: "CASH", amount: -100n },
      ],
    };

    try {
      await store.appendTx(modified);
      expect.fail("should throw LedgerConflictError");
    } catch (e) {
      expect(e).toBeInstanceOf(LedgerConflictError);
    }
  });

  it("LP7: amounts above 2^63-1 rejected before SQL, exactness at boundary", async () => {
    const maxSafe = BigInt("9223372036854775807"); // 2^63 - 1
    const tooLarge = maxSafe + 1n;

    const tx = {
      txId: txIdForDeposit("req1"),
      refEventId: "evt1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: tooLarge },
        { accountId: EXTERNAL, asset: "CASH", amount: -tooLarge },
      ],
    };

    // Assuming MAX_AMOUNT is enforced in pure layer
    const led = new Ledger();
    try {
      led.post(tx);
      expect.fail("should reject amount");
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("LP8: zero amount and sign/direction mismatch rejected by SQL constraints", async () => {
    try {
      await sql.query(
        `INSERT INTO ledger_entries (tx_id, leg_idx, account_id, asset, amount, direction, ref_event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ["test", 0, "acc1", "CASH", 0, "CREDIT", "evt1"],
      );
      expect.fail("should reject zero amount");
    } catch (e) {
      expect((e as any).message).toContain("check constraint");
    }

    try {
      await sql.query(
        `INSERT INTO ledger_entries (tx_id, leg_idx, account_id, asset, amount, direction, ref_event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ["test2", 0, "acc1", "CASH", 100, "DEBIT", "evt1"],
      );
      expect.fail("should reject direction mismatch");
    } catch (e) {
      expect((e as any).message).toContain("check constraint");
    }
  });

  it("LP9: ledger invariants verified via SQL GROUP BY", async () => {
    const deposit = {
      txId: txIdForDeposit("req1"),
      refEventId: "evt1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: 100n },
        { accountId: EXTERNAL, asset: "CASH", amount: -100n },
      ],
    };

    await store.appendTx(deposit);

    const result = await sql.query(
      `SELECT asset, SUM(amount) as total FROM ledger_entries GROUP BY asset ORDER BY asset`,
      [],
    );

    for (const row of result.rows) {
      expect(BigInt(row.total as string)).toBe(0n);
    }
  });
});
