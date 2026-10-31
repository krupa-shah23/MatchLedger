import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { setUpIsolatedSchema, createSqlExecutor, type IsolatedSchema } from "@matchledger/journal";
import { ENDPOINT_ROLES, serializeRiskState, deserializeRiskState } from "@matchledger/common";
import { recoverRiskPartition } from "@matchledger/risk";
import { createLiveRuntime } from "@matchledger/runtime";
import { createPostgresRunner } from "@matchledger/shard";
import { TransactionalProducer } from "@matchledger/transport";
import { buildApp } from "./app.js";
import { signToken } from "./auth/tokens.js";
import type { Config } from "./config.js";
import type { FastifyInstance } from "fastify";

describe.skipIf(process.env.RUN_INTEGRATION !== "1")("isolated live verification", () => {
  let schema: IsolatedSchema;
  let runtime: Awaited<ReturnType<typeof createLiveRuntime>>;
  let app: FastifyInstance;
  let base: string;
  let authorization: string;
  const instruments = new Map([["PROBE", { symbol: "PROBE", tickSize: 1n, lotSize: 1n, maxPrice: 100000n, maxQuantity: 10000n }]]);
  const config: Config = {
    NODE_ENV: "development", PORT: 3000, METRICS_PORT: 3001,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
    JWT_SECRET: "isolated-verification-test-secret-32", JWT_TTL_SECONDS: 900, SESSION_MAX_SECONDS: 28800,
    PROFILE: "demo", PRICE_DECIMALS: 2, RATE_LIMIT_ORDERS_PER_SEC: 10, RATE_LIMIT_BURST: 20,
    PROJECTOR_POLL_MS: 200, PROJECTOR_CHUNK: 1000,
  };
  beforeAll(async () => {
    schema = await setUpIsolatedSchema(config.DATABASE_URL, "live_verification", fileURLToPath(new URL("../../journal/migrations/", import.meta.url)));
    runtime = await createLiveRuntime({ sql: createSqlExecutor(schema.pool), instruments,
      queueCapacity: 10, maxBatch: 10, heartbeatMs: 100, onFatal: error => { throw error; } });
    await runtime.deposit("probe-account", "CASH", 100000n, "probe-deposit");
    app = await buildApp({ config, executor: createSqlExecutor(schema.pool), facade: runtime,
      instruments: [], riskConfig: runtime.riskConfig, simulatorState: { current: null },
      prometheusUrl: process.env.LIVE_PROMETHEUS_URL ?? "http://127.0.0.1:9090",
      // Refused requests must never reach this real (uninitialized) producer.
      commandRouter: { producer: new TransactionalProducer({ brokers: ["localhost:29092"], transactionalId: "refusal-only-probe" }), brokers: ["localhost:29092"], shardPartitions: 4 } });
    base = await app.listen({ host: "127.0.0.1", port: 0 });
    authorization = `Bearer ${await signToken({ secret: new TextEncoder().encode(config.JWT_SECRET), ttlSeconds: 900 }, "probe-user", "ADMIN")}`;
  });
  afterAll(async () => { await app?.close(); await runtime?.stop(); await schema?.teardown(); });

  it("LIVE-TIMELINE: real journal audit data is readable by ADMIN and hidden from a different trader", async () => {
    await schema.pool.query("INSERT INTO order_requests(account_id,client_order_id,payload_hash,order_id) VALUES('another-account','private-fixture','fixture-hash','private-order')");
    await schema.pool.query("INSERT INTO journal(stream_id,seq,record_type,idx,schema_version,ts,writer_epoch,payload_json) VALUES('risk-private',1,'COMMAND',0,1,1,1,$1)", [{ type: "SubmitOrder", orderId: "private-order", accountId: "another-account" }]);
    const admin = await fetch(base + "/orders/private-order/events", { headers: { authorization } });
    expect(admin.status).toBe(200);
    expect(await admin.json()).toEqual(expect.arrayContaining([expect.objectContaining({ type: "SubmitOrder" })]));
    const token = await signToken({ secret: new TextEncoder().encode(config.JWT_SECRET), ttlSeconds: 900 }, "different-trader", "TRADER");
    const trader = await fetch(base + "/orders/private-order/events", { headers: { authorization: `Bearer ${token}` } });
    expect(trader.status).toBe(404);
  });

  it("LIVE-RISK: JSONB rejection snapshots decode and breaker counts use actual read models", async () => {
    await schema.pool.query("INSERT INTO rejections_view(source,order_id,account_id,symbol,reason,snapshot_json,ts) VALUES('RISK','jsonb-probe','probe-account','PROBE','INSUFFICIENT_BALANCE',$1,1)", [{ cash: "100000", heldCash: "0" }]);
    await schema.pool.query("INSERT INTO breaker_view(symbol,state) VALUES('PROBE','OPEN')");
    await schema.pool.query("INSERT INTO resting_orders(symbol,order_id,side,price,remaining) VALUES('PROBE','resting-probe','BUY',10,1)");
    await schema.pool.query("INSERT INTO reservations_view(order_id,account_id,symbol,side,asset,amount_total,amount_remaining,status) VALUES('resting-probe','probe-account','PROBE','BUY','CASH',10,10,'PLACED')");
    const rejections = await fetch(base + "/risk/rejections", { headers: { authorization } });
    expect(rejections.status).toBe(200);
    expect(await rejections.json()).toEqual(expect.arrayContaining([expect.objectContaining({ snapshot: { cash: "100000", heldCash: "0" } })]));
    const breakers = await fetch(base + "/risk/breakers", { headers: { authorization } });
    expect(breakers.status).toBe(200);
    expect(await breakers.json()).toEqual(expect.arrayContaining([expect.objectContaining({ symbol: "PROBE", restingOrders: 1, heldFunds: "0.10" })]));
  });

  it("LIVE-ROLE-MATRIX: all forbidden catalogue role/write pairs return HTTP 403", async () => {
    let checked = 0;
    for (const role of ["TRADER", "RISK", "OPS", "ADMIN"] as const) {
      const token = await signToken({ secret: new TextEncoder().encode(config.JWT_SECRET), ttlSeconds: 900 }, "probe-user", role);
      for (const [endpoint, roles] of Object.entries(ENDPOINT_ROLES)) {
        const [method, path] = endpoint.split(" ");
        if (!method || !path) throw new Error(`Malformed endpoint catalogue entry: ${endpoint}`);
        if (method === "GET" || path.startsWith("/auth/") || roles.has(role)) continue;
        const response = await fetch(base + path.replace(/\{[^}]+\}/g, "probe"), {
          method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}",
        });
        console.log(`ROLE ${role} ${endpoint} ${response.status}`);
        expect(response.status, `${role} ${endpoint}`).toBe(403);
        checked++;
      }
    }
    const expected = Object.entries(ENDPOINT_ROLES).filter(([endpoint]) => !endpoint.startsWith("GET ") && !endpoint.includes(" /auth/"))
      .reduce((count, [, roles]) => count + 4 - roles.size, 0);
    console.log("FORBIDDEN-PAIRS", checked);
    expect(checked).toBe(expected);
    expect(checked).toBeGreaterThan(40);
  });

  it("LIVE-HEARTBEAT: stale owner can upsert heartbeat and shard endpoint joins actual rows", async () => {
    const runner = await createPostgresRunner({ sql: createSqlExecutor(schema.pool), symbols: new Map(),
      leaseId: "unfenced-probe", owner: "old-owner", queueCapacity: 1, maxBatch: 1,
      onOutputs: async () => { throw new Error("No orders expected"); }, onFatal: error => { throw error; } });
    await schema.pool.query("UPDATE shard_leases SET epoch=epoch+1,owner='new-owner' WHERE lease_id='unfenced-probe'");
    await runner.heartbeat();
    expect((await schema.pool.query("SELECT 1 FROM shard_heartbeats WHERE lease_id='unfenced-probe'")).rowCount).toBe(1);
    await schema.pool.query("UPDATE shard_heartbeats SET owned_symbols=ARRAY['JOIN-PROBE'],last_seq=5 WHERE lease_id='unfenced-probe'");
    await schema.pool.query("INSERT INTO snapshots(stream_id,last_seq,last_ts,schema_version,state_json,checksum) VALUES('JOIN-PROBE',3,1,1,'{}','probe')");
    await schema.pool.query("INSERT INTO journal(stream_id,seq,record_type,idx,schema_version,ts,writer_epoch,payload_json) VALUES('JOIN-PROBE',7,'EVENT',0,1,1,1,'{}')");
    const response = await fetch(base + "/system/shards", { headers: { authorization } });
    expect(response.status).toBe(200);
    const body = await response.json() as { shards: Array<Record<string, unknown>> };
    const shard = body.shards.find(row => row.leaseId === "unfenced-probe");
    console.log("JOIN", shard);
    expect(shard).toMatchObject({ owner: "new-owner", epoch: 2, lastSeq: 5, snapshotSeq: 3, journalSeq: 7, ownedSymbols: ["JOIN-PROBE"], isStale: false });
  });

  // Opt in only after stopping the real service; ordinary integration runs must
  // also work when a developer has Prometheus running.
  it.skipIf(process.env.LIVE_PROMETHEUS_DOWN !== "1")("LIVE-PROM-DOWN: stopped Prometheus returns HTTP 200 with available false (requires LIVE_PROMETHEUS_DOWN=1)", async () => {
    await expect(fetch((process.env.LIVE_PROMETHEUS_URL ?? "http://127.0.0.1:9090") + "/-/ready")).rejects.toThrow();
    const response = await fetch(base + "/system/metrics/summary", { headers: { authorization } });
    const body: unknown = await response.json();
    console.log("PROMETHEUS-DOWN", response.status, body);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ available: false, commandsPerSec: null, latencyMs: null });
  });

  it("LIVE-REPLAY: healthy snapshot equals replay; corrupted checksum does not", async () => {
    const recovered = await recoverRiskPartition({ sql: createSqlExecutor(schema.pool), partition: 0, config: runtime.riskConfig });
    const state = serializeRiskState(recovered.core.exportState());
    const checksum = createHash("sha256").update(state).digest("hex");
    await schema.pool.query("INSERT INTO snapshots(stream_id,last_seq,last_ts,schema_version,state_json,checksum) VALUES('risk-snapshot-0',$1,$2,1,$3,$4)", [recovered.lastSeq, recovered.lastTs, state, checksum]);
    const verify = async () => {
      const response = await fetch(base + "/system/verify-replay", { method: "POST", headers: { authorization, "Content-Type": "application/json" }, body: JSON.stringify({ streamId: "risk-snapshot-0" }) });
      expect(response.status).toBe(200);
      return await response.json() as { equal: boolean };
    };
    console.log("REPLAY-HEALTHY", await verify());
    expect(await verify()).toMatchObject({ equal: true });
    await schema.pool.query("UPDATE snapshots SET checksum='corrupted-copy' WHERE stream_id='risk-snapshot-0'");
    console.log("REPLAY-CORRUPTED-CHECKSUM", await verify());
    expect(await verify()).toMatchObject({ equal: false });
    // Observe payload-only corruption separately: recovery discards that invalid
    // snapshot, but the endpoint currently compares against its original checksum.
    await schema.pool.query("UPDATE snapshots SET state_json=jsonb_set(state_json,'{accounts,0,cash}','\"999999\"'::jsonb),checksum=$1 WHERE stream_id='risk-snapshot-0'", [checksum]);
    expect((await schema.pool.query("SELECT state_json #>> '{accounts,0,cash}' AS cash FROM snapshots WHERE stream_id='risk-snapshot-0'")).rows[0].cash).toBe("999999");
    expect(await verify()).toMatchObject({ equal: false });
    // Even a self-consistent, validly checksummed fork must disagree with
    // independent genesis replay rather than becoming its own reference.
    const tampered = (await schema.pool.query("SELECT state_json FROM snapshots WHERE stream_id='risk-snapshot-0'")).rows[0].state_json;
    const tamperedChecksum = createHash("sha256").update(serializeRiskState(deserializeRiskState(JSON.stringify(tampered)))).digest("hex");
    await schema.pool.query("UPDATE snapshots SET checksum=$1 WHERE stream_id='risk-snapshot-0'", [tamperedChecksum]);
    expect(await verify()).toMatchObject({ equal: false });
    await schema.pool.query("UPDATE snapshots SET state_json=$1,checksum=$2 WHERE stream_id='risk-snapshot-0'", [state, checksum]);
    await runtime.deposit("probe-account", "CASH", 100n, "after-snapshot");
    expect(await verify()).toMatchObject({ equal: true, upToSeq: recovered.lastSeq });
  });
});
