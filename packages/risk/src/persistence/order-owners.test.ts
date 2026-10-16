import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createSqlExecutor, setUpIsolatedSchema } from "@matchledger/journal";
import type { IsolatedSchema, SqlExecutor } from "@matchledger/journal";
import { OrderOwnerStore, OwnerConflictError } from "./order-owners.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const migrationsDir = join(__filename, "..", "..", "..", "..", "journal", "migrations");

describe.skipIf(!run)("OrderOwnerStore (OW1-OW4)", () => {
  let isolated: IsolatedSchema;
  let pool: IsolatedSchema["pool"];
  let sql: SqlExecutor;
  let store: OrderOwnerStore;

  beforeAll(async () => {
    isolated = await setUpIsolatedSchema(
      process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
      "order_owners_test",
      migrationsDir,
    );
    pool = isolated.pool;
    sql = createSqlExecutor(pool);
    store = new OrderOwnerStore(sql);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE order_owners CASCADE");
  });

  afterAll(async () => {
    if (isolated) await isolated.teardown();
  });

  it("OW1: insertOwner idempotent, identical content returns inserted false", async () => {
    const owner = { orderId: "o1", accountId: "acc1", symbol: "AAPL", side: "BUY" as const };

    const r1 = await store.insertOwner(owner);
    expect(r1.inserted).toBe(true);

    const r2 = await store.insertOwner(owner);
    expect(r2.inserted).toBe(false);

    const rows = await pool.query("SELECT COUNT(*) FROM order_owners WHERE order_id = $1", ["o1"]);
    expect(rows.rows[0]!.count).toBe(1);
  });

  it("OW2: insertOwner with different account/symbol/side throws OwnerConflictError", async () => {
    const owner = { orderId: "o1", accountId: "acc1", symbol: "AAPL", side: "BUY" as const };
    await store.insertOwner(owner);

    const different = { orderId: "o1", accountId: "acc2", symbol: "AAPL", side: "BUY" as const };

    try {
      await store.insertOwner(different);
      expect.fail("should throw OwnerConflictError");
    } catch (e) {
      expect(e).toBeInstanceOf(OwnerConflictError);
    }
  });

  it("OW3: lookupMany handles batches correctly", async () => {
    const owners = Array.from({ length: 2500 }, (_, i) => ({
      orderId: `o${i}`,
      accountId: `acc${i % 100}`,
      symbol: "AAPL",
      side: "BUY" as const,
    }));

    // Insert in parallel to speed up test
    await Promise.all(owners.map((o) => store.insertOwner(o)));

    const orderIds = owners.map((o) => o.orderId);
    const result = await store.lookupMany(orderIds);

    expect(result.size).toBe(2500);
    for (let i = 0; i < Math.min(100, owners.length); i++) {
      expect(result.get(owners[i]!.orderId)).toEqual(owners[i]);
    }
  });

  it("OW4: lookupMany with empty list returns empty map", async () => {
    const result = await store.lookupMany([]);
    expect(result.size).toBe(0);
  });
});
