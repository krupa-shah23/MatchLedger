import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { setUpIsolatedSchema, createSqlExecutor, type IsolatedSchema } from "@matchledger/journal";
import { PAGE_WRITE_ENDPOINTS, ENDPOINT_ROLES, type ApiRole } from "@matchledger/common";
import { buildApp } from "./app.js";
import { signToken } from "./auth/tokens.js";
import type { Config } from "./config.js";
import type { RuntimeFacade } from "./orders/submit.js";
import type { FastifyInstance } from "fastify";

const enabled = process.env.RUN_INTEGRATION === "1";
const config: Config = {
  NODE_ENV: "development", PORT: 3000, METRICS_PORT: 3001,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres",
  JWT_SECRET: "week11-live-test-secret-32-characters", JWT_TTL_SECONDS: 900, SESSION_MAX_SECONDS: 28800,
  PROFILE: "demo", PRICE_DECIMALS: 2, RATE_LIMIT_ORDERS_PER_SEC: 10, RATE_LIMIT_BURST: 20,
  PROJECTOR_POLL_MS: 200, PROJECTOR_CHUNK: 1000,
};

describe.skipIf(!enabled)("Week 11 real HTTP and Postgres probes", () => {
  let schema: IsolatedSchema;
  let app: FastifyInstance;
  let base: string;
  let runtimeCalls = 0;
  // These probes must never dispatch a runtime command: they test refusals,
  // monitoring and reset. Fail loudly if a guard accidentally permits a write.
  const unexpected = async (): Promise<never> => { runtimeCalls++; throw new Error("Unexpected runtime dispatch"); };
  const facade: RuntimeFacade = { hasSubmitCommand: unexpected, submitOrder: unexpected,
    cancelOrder: unexpected, haltSymbol: unexpected, resumeSymbol: unexpected, deposit: unexpected,
    riskView: unexpected, internalTrades: unexpected };
  const tokenFor = (role: ApiRole) => signToken({ secret: new TextEncoder().encode(config.JWT_SECRET), ttlSeconds: 900 }, "live-probe", role);
  beforeAll(async () => {
    schema = await setUpIsolatedSchema(config.DATABASE_URL, "week11_http", fileURLToPath(new URL("../../journal/migrations/", import.meta.url)));
    app = await buildApp({ config, executor: createSqlExecutor(schema.pool), facade, instruments: [], simulatorState: { current: null } });
    base = await app.listen({ host: "127.0.0.1", port: 0 });
  });
  afterAll(async () => { await app?.close(); await schema?.teardown(); });

  it("UG-server: every forbidden page/role write receives 403 over HTTP", async () => {
    for (const endpoint of new Set(Object.values(PAGE_WRITE_ENDPOINTS).flat())) {
      const [method, route] = endpoint.split(" ") as [string, string];
      for (const role of ["TRADER", "RISK", "OPS", "ADMIN"] as const) {
        if (ENDPOINT_ROLES[endpoint]?.has(role)) continue;
        const res = await fetch(base + route.replace(/\{[^}]+\}/g, "probe"), {
          method, headers: { Authorization: `Bearer ${await tokenFor(role)}`, "Content-Type": "application/json" }, body: "{}",
        });
        expect(res.status, `${role} ${endpoint}`).toBe(403);
      }
    }
    expect(runtimeCalls).toBe(0);
  });

  it("CH5-live: demo reset twice preserves real journal rows", async () => {
    await schema.pool.query("INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json) VALUES ('reset-probe', 1, 'COMMAND', 0, 1, 1, 1, '{}')");
    const count = async () => (await schema.pool.query("SELECT COUNT(*)::int AS n FROM journal")).rows[0].n;
    const before = await count();
    for (let i = 0; i < 2; i++) {
      const response = await fetch(base + "/admin/demo/reset", { method: "POST", headers: { Authorization: `Bearer ${await tokenFor("ADMIN")}` } });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ reset: true });
      expect(await count()).toBe(before);
    }
    expect(before).toBe(1);
  });

  it("CH3-live: prod demo/reset/chaos endpoints refuse even ADMIN with 404, even when a commandRouter is configured", async () => {
    // A commandRouter is deliberately supplied here: the demo gate must be
    // `isDemo && commandRouter`, not `commandRouter` alone. Without a
    // commandRouter present, PROFILE=prod and PROFILE=demo-without-router
    // would be indistinguishable from this probe's point of view.
    const prod = await buildApp({ config: { ...config, PROFILE: "prod" }, executor: createSqlExecutor(schema.pool), facade, instruments: [], simulatorState: { current: null },
      commandRouter: { producer: {} as any, brokers: ["localhost:1"], shardPartitions: 1 } });
    const address = await prod.listen({ host: "127.0.0.1", port: 0 });
    try {
      for (const path of ["/admin/demo/reset", "/admin/demo/chaos/kill/ACME", "/admin/demo/chaos/freeze/ACME"]) {
        const response = await fetch(address + path, { method: "POST", headers: { Authorization: `Bearer ${await tokenFor("ADMIN")}` } });
        expect(response.status, path).toBe(404);
      }
    } finally { await prod.close(); }
  });

  it("HT3-live: stale threshold is three heartbeat intervals in real SQL", async () => {
    await schema.pool.query("INSERT INTO shard_leases (lease_id, owner, epoch) VALUES ('shard-probe', 'probe', 1)");
    await schema.pool.query("INSERT INTO shard_heartbeats (lease_id, last_heartbeat_at, owned_symbols) VALUES ('shard-probe', now() - interval '11 seconds', '{}')");
    const response = await fetch(base + "/system/shards", { headers: { Authorization: `Bearer ${await tokenFor("ADMIN")}` } });
    expect(response.status).toBe(200);
    const body = await response.json() as { shards: Array<{ leaseId: string; isStale: boolean }> };
    expect(body.shards.find(s => s.leaseId === "shard-probe")).toMatchObject({ isStale: false });
    await schema.pool.query("UPDATE shard_heartbeats SET last_heartbeat_at = now() - interval '16 seconds' WHERE lease_id = 'shard-probe'");
    const stale = await fetch(base + "/system/shards", { headers: { Authorization: `Bearer ${await tokenFor("ADMIN")}` } });
    expect((await stale.json() as typeof body).shards.find(s => s.leaseId === "shard-probe")).toMatchObject({ isStale: true });
  });
});
