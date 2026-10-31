import { it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { setUpIsolatedSchema, createSqlExecutor } from "@matchledger/journal";
import { createLiveRuntime } from "./live-runtime.js";

it.skipIf(process.env.RUN_INTEGRATION !== "1")("LIVE1: durable submit, backpressure and engine/risk recovery across restart", async () => {
  const schema = await setUpIsolatedSchema(process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres", "live_runtime", fileURLToPath(new URL("../../journal/migrations/", import.meta.url)));
  const config = { sql: createSqlExecutor(schema.pool), instruments: new Map([["ABC", { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxPrice: 100000n, maxQuantity: 10000n }]]),
    queueCapacity: 1, maxBatch: 10, heartbeatMs: 50, onFatal: (error: unknown) => { throw error; } };
  let runtime: Awaited<ReturnType<typeof createLiveRuntime>> | undefined;
  const until = async (predicate: () => Promise<boolean>) => {
    const deadline = Date.now() + 5000;
    while (!await predicate()) {
      if (Date.now() > deadline) throw new Error("Runtime did not become durable");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  try {
    runtime = await createLiveRuntime(config);
    await runtime.deposit("buyer", "CASH", 1000000n, "initial-deposit");
    const request = { type: "SubmitOrder", orderId: "live-order", accountId: "buyer", symbol: "ABC", side: "BUY", kind: "LIMIT", timeInForce: "GTC", price: 5000n, quantity: 2n };
    const submit = runtime.submitOrder(request);
    expect(await runtime.submitOrder({ ...request, orderId: "over-capacity" })).toEqual({ kind: "FULL" });
    expect(await submit).toEqual({ kind: "JOURNALED" });
    await until(async () => (await schema.pool.query("SELECT 1 FROM journal WHERE stream_id='ABC' AND record_type='EVENT' AND payload_json->>'type'='ORDER_RESTED'")).rows.length === 1);
    await runtime.stop();
    // Scratch-schema crash simulation: the command is durable but its output
    // and deposit ledger posting were not committed before the process died.
    await schema.pool.query("DELETE FROM journal WHERE stream_id='ABC' AND record_type='EVENT'");
    await schema.pool.query("DELETE FROM ledger_entries WHERE tx_id='deposit:initial-deposit'");
    runtime = await createLiveRuntime(config);
    expect(await runtime.hasSubmitCommand("live-order")).toBe(true);
    expect((await schema.pool.query("SELECT COUNT(*)::int AS n FROM journal WHERE stream_id='ABC' AND record_type='EVENT'")).rows[0].n).toBe(2);
    expect((await schema.pool.query("SELECT COUNT(*)::int AS n FROM ledger_entries WHERE tx_id='deposit:initial-deposit'")).rows[0].n).toBe(2);
    expect(await runtime.riskView("buyer")).toMatchObject({ cash: 1000000n, heldCash: 10000n });
    expect(await runtime.submitOrder(request)).toEqual({ kind: "JOURNALED" });
    expect((await schema.pool.query("SELECT COUNT(*)::int AS n FROM journal WHERE stream_id='ABC' AND record_type='COMMAND'")).rows[0].n).toBe(1);
    expect((await schema.pool.query("SELECT epoch FROM shard_leases WHERE lease_id='inproc-engine'")).rows[0].epoch).toBe(2);
    expect((await schema.pool.query("SELECT COUNT(*)::int AS n FROM recovery_log WHERE lease_id='inproc-engine'")).rows[0].n).toBe(2);
  } finally { await runtime?.stop(); await schema.teardown(); }
});
