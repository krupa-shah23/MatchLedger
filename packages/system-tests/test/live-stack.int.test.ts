import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setUpIsolatedSchema, withSchema, type IsolatedSchema } from "@matchledger/journal";
import { TransactionalProducer, encodeEnvelope } from "@matchledger/transport";
import { partitionOf } from "@matchledger/common";

// Explicit opt-in: use a separate broker, never send chaos to the demo broker.
const enabled = process.env.RUN_LIVE_STACK === "1";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const brokers = process.env.LIVE_KAFKA_BROKERS ?? "localhost:39092";
const database = process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres";
const symbols = Array.from({ length: 16 }, (_, i) => `LIVE${i}`);
const specs = (names: string[]) => JSON.stringify(names.map(symbol => ({ symbol, tickSize: "1", lotSize: "1", maxQuantity: "1000000", maxPrice: "1000000" })));
const children: Array<{ process: ChildProcess; log: string }> = [];
const schemas: IsolatedSchema[] = [];
const alive = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;

async function until(check: () => Promise<boolean>, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (!await check()) {
    if (Date.now() > deadline) throw new Error(`Live verification timed out\n${children.map(c => c.log).join("\n")}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
async function scratch() {
  const schema = await setUpIsolatedSchema(database, "live_stack", root + "packages/journal/migrations");
  schemas.push(schema);
  return schema;
}
function launch(file: string, schema: IsolatedSchema, env: NodeJS.ProcessEnv) {
  const process = spawn(globalThis.process.execPath, [file], { cwd: root, env: {
    ...globalThis.process.env, DATABASE_URL: withSchema(database, schema.schema), KAFKA_BROKERS: brokers,
    NODE_ENV: "development", METRICS_PORT: "0", PROFILE: "prod", SESSION_TIMEOUT_MS: "6000", MAX_POLL_INTERVAL_MS: "60000",
    HEARTBEAT_MS: "200", ...env,
  } });
  const child = { process, log: "" };
  const capture = (chunk: Buffer) => { child.log = (child.log + chunk.toString()).slice(-100000); };
  process.stdout?.on("data", capture);
  process.stderr?.on("data", capture);
  children.push(child);
  return child;
}
async function stop(child: ChildProcess) {
  if (!alive(child)) return;
  child.kill("SIGCONT");
  const exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  const timer = setTimeout(() => { if (alive(child)) child.kill("SIGKILL"); }, 5000);
  await exited;
  clearTimeout(timer);
}
async function port() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No TCP port");
  await new Promise<void>(resolve => server.close(() => resolve()));
  return address.port;
}
async function send(symbol: string, orderId: string) {
  const producer = new TransactionalProducer({ brokers: brokers.split(","), transactionalId: `live-flow-${orderId}` });
  await producer.init();
  try {
    await producer.sendBatch("orders.accepted", [{ key: symbol, partition: partitionOf(symbol, 4),
      value: JSON.stringify({ kind: "PLACE", symbol, orderId, side: "BUY", orderType: "LIMIT", price: "5000", quantity: "1", ts: "1" }) }]);
  } finally { await producer.disconnect(); }
}
afterEach(async () => {
  for (const child of children.splice(0)) await stop(child.process);
  for (const schema of schemas.splice(0)) await schema.teardown();
});

describe.skipIf(!enabled)("real isolated Kafka stack (requires RUN_LIVE_STACK=1 and private LIVE_KAFKA_BROKERS)", () => {
  it("CH-live: production ignores real chaos messages and demo consumes FreezeShard and KillShard", async () => {
    const schema = await scratch();
    const symbol = `CHAOS${schema.schema.toUpperCase()}`;
    const env = { TRANSPORT: "kafka", SHARD_GROUP_ID: `profile-${schema.schema}`, INSTRUMENTS_JSON: specs([symbol]) };
    const producer = new TransactionalProducer({ brokers: brokers.split(","), transactionalId: `profile-${schema.schema}` });
    await producer.init();
    const command = async (type: string) => producer.sendBatch("control.commands", [{ key: symbol, partition: partitionOf(symbol, 4),
      value: encodeEnvelope({ schemaVersion: 1, msgId: `${type}-${Date.now()}`, type, payload: { type, symbol, durationMs: 1500 } }) }]);
    try {
      const prod = launch("packages/shard/dist/main.js", schema, { ...env, SHARD_ID: "profile-prod", PROFILE: "prod" });
      await until(async () => (await schema.pool.query("SELECT 1 FROM shard_heartbeats")).rowCount === 4);
      const before = (await schema.pool.query("SELECT max(last_heartbeat_at) AS t FROM shard_heartbeats")).rows[0].t;
      await command("KillShard");
      await command("FreezeShard");
      await until(async () => (await schema.pool.query("SELECT max(last_heartbeat_at)>$1 AS advanced FROM shard_heartbeats", [before])).rows[0].advanced === true);
      expect(alive(prod.process)).toBe(true);
      await stop(prod.process);
      const demo = launch("packages/shard/dist/main.js", schema, { ...env, SHARD_ID: `profile-demo-${schema.schema}`, PROFILE: "demo" });
      await until(async () => (await schema.pool.query("SELECT 1 FROM shard_leases WHERE owner=$1", [`profile-demo-${schema.schema}`])).rowCount === 4);
      const apiPort = await port(), metricsPort = await port();
      const api = launch("packages/api/dist/main.js", schema, { TRANSPORT: "kafka", PROFILE: "demo", SEED_DEMO: "1", PORT: String(apiPort), METRICS_PORT: String(metricsPort), JWT_SECRET: "live-chaos-fixture-secret-at-least-32-characters", INSTRUMENTS_JSON: specs([symbol]) });
      const base = `http://127.0.0.1:${apiPort}`;
      await until(async () => { if (!alive(api.process)) throw new Error(api.log); try { return (await fetch(base + "/me")).status === 401; } catch { return false; } });
      const login = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "demo-admin", password: "demo-password" }) });
      expect(login.status).toBe(200);
      const session = await login.json() as { token: string };
      const headers = { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
      const status = await fetch(base + "/system/shards", { headers });
      expect(await status.json()).toMatchObject({ chaosEnabled: true });
      const demoCommand = async (type: "KillShard" | "FreezeShard") => {
        const response = await fetch(base + `/admin/demo/chaos/${type === "KillShard" ? "kill" : "freeze"}/${symbol}`, { method: "POST", headers, body: JSON.stringify({ durationMs: 1500, reason: "Real HTTP chaos verification" }) });
        expect(response.status).toBe(202);
      };
      // Synchronize on the real heartbeat pause, rather than assuming a sleep
      // means the command was consumed. At most three bootstrap attempts.
      let frozenHeartbeat: Date | undefined;
      for (let attempt = 0; attempt < 3 && !frozenHeartbeat; attempt++) {
        await demoCommand("FreezeShard");
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const heartbeat = (await schema.pool.query("SELECT max(last_heartbeat_at) AS t, now()-max(last_heartbeat_at)>interval '800 milliseconds' AS paused FROM shard_heartbeats")).rows[0];
          if (heartbeat.paused) { frozenHeartbeat = heartbeat.t; break; }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      expect(frozenHeartbeat).toBeDefined();
      expect(alive(demo.process)).toBe(true);
      await until(async () => (await schema.pool.query("SELECT max(last_heartbeat_at)>$1 AS advanced FROM shard_heartbeats", [frozenHeartbeat])).rows[0].advanced === true);
      await until(async () => { if (!alive(demo.process)) return true; await demoCommand("KillShard"); return false; });
      expect(demo.process.exitCode).toBe(1);
    } finally { await producer.disconnect(); }
  }, 60000);

  it("SP1-live: identical authenticated order flow gives identical orders, fills and ledger in both transports", async () => {
    const results: unknown[] = [];
    for (const transport of ["inproc", "kafka"] as const) {
      const schema = await scratch();
      if (transport === "kafka") {
        launch("packages/shard/dist/main.js", schema, { TRANSPORT: "kafka", SHARD_ID: "parity-shard", SHARD_GROUP_ID: `parity-${schema.schema}`, INSTRUMENTS_JSON: specs(["ACME"]) });
        await until(async () => (await schema.pool.query("SELECT 1 FROM shard_leases WHERE lease_id=$1", [`shard-${partitionOf("ACME", 4)}`])).rowCount === 1);
      }
      const apiPort = await port(), metricsPort = await port();
      const api = launch("packages/api/dist/main.js", schema, { TRANSPORT: transport, PROFILE: "demo", SEED_DEMO: "1",
        PORT: String(apiPort), METRICS_PORT: String(metricsPort), JWT_SECRET: "live-stack-fixture-secret-at-least-32-characters", INSTRUMENTS_JSON: specs(["ACME"]) });
      const base = `http://127.0.0.1:${apiPort}`;
      await until(async () => { if (!alive(api.process)) throw new Error(api.log); try { return (await fetch(base + "/me")).status === 401; } catch { return false; } });
      const ids: string[] = [];
      for (const [user, side] of [["demo-simulator", "SELL"], ["demo-trader", "BUY"]]) {
        const login = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user, password: "demo-password" }) });
        expect(login.status).toBe(200);
        const session = await login.json() as { token: string };
        const response = await fetch(base + "/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ clientOrderId: `parity-${side}`, symbol: "ACME", side, type: "LIMIT", timeInForce: "GTC", quantity: "1", price: "50.00" }) });
        expect(response.status, await response.clone().text()).toBe(202);
        const order = await response.json() as { orderId: string };
        ids.push(order.orderId);
        await until(async () => (await schema.pool.query("SELECT 1 FROM orders_view WHERE order_id=$1 AND (rested OR filled_qty>0)", [order.orderId])).rowCount === 1);
      }
      await until(async () => (await schema.pool.query("SELECT 1 FROM ledger_entries WHERE tx_id LIKE 'trade:%'")).rowCount === 4);
      const orders = (await schema.pool.query("SELECT account_id,symbol,side,quantity::text,filled_qty::text,filled_notional::text FROM orders_view WHERE order_id=ANY($1) ORDER BY account_id", [ids])).rows;
      expect(orders).toHaveLength(2);
      expect(orders.every(row => row.filled_qty === "1")).toBe(true);
      const ledger = (await schema.pool.query("SELECT account_id,asset,SUM(amount)::text AS amount FROM ledger_entries GROUP BY account_id,asset ORDER BY account_id,asset")).rows;
      const recoveries = (await schema.pool.query("SELECT DISTINCT lease_id FROM recovery_log")).rows;
      expect(recoveries.map(row => row.lease_id)).toContain("control-plane");
      results.push({ orders, ledger });
      for (const child of children.splice(0)) await stop(child.process);
    }
    expect(results[1]).toEqual(results[0]);
  }, 120000);

  for (const scenario of ["R7", "R11"] as const) {
    it(`${scenario}-live: real takeover fences the stopped or stalled owner and preserves contiguous journal rows`, async () => {
      const schema = await scratch();
      const ownedSymbols = symbols.map(symbol => symbol + schema.schema.toUpperCase());
      const env = { TRANSPORT: "kafka", SHARD_GROUP_ID: `chaos-${schema.schema}`, INSTRUMENTS_JSON: specs(ownedSymbols) };
      const a = launch("packages/shard/dist/main.js", schema, { ...env, SHARD_ID: "live-A", ...(scenario === "R11" ? {
        MAX_POLL_INTERVAL_MS: "8000", NODE_OPTIONS: `--import=${root}packages/system-tests/test/fixtures/stall-hook.mjs`,
      } : {}) });
      launch("packages/shard/dist/main.js", schema, { ...env, SHARD_ID: "live-B" });
      await until(async () => {
        const rows = (await schema.pool.query("SELECT lease_id,owner FROM shard_leases WHERE owner IS NOT NULL")).rows;
        return rows.length === 4 && new Set(rows.map(row => row.owner)).size === 2;
      });
      const leases = (await schema.pool.query("SELECT lease_id,owner,epoch FROM shard_leases")).rows;
      const symbol = ownedSymbols.find(name => leases.some(row => row.lease_id === `shard-${partitionOf(name, 4)}` && row.owner === "live-A"));
      if (!symbol) throw new Error("First worker owns no instrument");
      const leaseId = `shard-${partitionOf(symbol, 4)}`;
      const epoch = BigInt(leases.find(row => row.lease_id === leaseId)!.epoch);
      a.process.kill(scenario === "R7" ? "SIGSTOP" : "SIGUSR2");
      const id = `chaos-${scenario}-${schema.schema}`;
      await send(symbol, id);
      await until(async () => {
        const row = (await schema.pool.query("SELECT owner,epoch FROM shard_leases WHERE lease_id=$1", [leaseId])).rows[0];
        return row?.owner === "live-B" && BigInt(row.epoch) > epoch;
      }, 35000);
      if (scenario === "R7") a.process.kill("SIGCONT");
      await until(async () => !alive(a.process), 10000);
      if (scenario === "R11") expect(a.log).toContain("Shard event loop stalled");
      await until(async () => (await schema.pool.query("SELECT 1 FROM journal WHERE stream_id=$1 AND record_type='EVENT' AND payload_json->>'type'='ORDER_RESTED' AND payload_json->>'orderId'=$2", [symbol, id])).rowCount === 1);
      const commands = (await schema.pool.query("SELECT seq,writer_epoch FROM journal WHERE stream_id=$1 AND record_type='COMMAND' ORDER BY seq", [symbol])).rows;
      expect(commands.length).toBeGreaterThan(0);
      commands.forEach((row, i) => expect(Number(row.seq)).toBe(i + 1));
      expect(commands.every(row => BigInt(row.writer_epoch) > epoch)).toBe(true);
    }, 60000);
  }
});
