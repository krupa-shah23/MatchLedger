import { fileURLToPath } from "node:url";
import { createPool, createSqlExecutor, runMigrations } from "@matchledger/journal";
import { createLiveRuntime } from "@matchledger/runtime";
import { Projector, NoticeBus } from "@matchledger/projections";
import { startMetricsServer } from "@matchledger/telemetry";
import { stopSimulator } from "@matchledger/simulator";
import type { SimulatorDriverState } from "@matchledger/simulator";
import type { FastifyInstance } from "fastify";
import type { Server } from "node:http";
import { loadConfig } from "./config.js";
import { loadStartupConfig } from "./startup-config.js";
import { buildApp } from "./app.js";
import { signToken } from "./auth/tokens.js";

export async function startApi() {
  const config = loadConfig();
  const startup = loadStartupConfig();
  if (config.PORT === config.METRICS_PORT) throw new Error("API and metrics ports must differ");
  if (startup.SEED_DEMO === "1" && config.PROFILE !== "demo") throw new Error("SEED_DEMO requires PROFILE=demo");
  const pool = createPool({ connectionString: config.DATABASE_URL });
  const lock = await pool.connect();
  let runtime: Awaited<ReturnType<typeof createLiveRuntime>> | undefined;
  let projector: Projector | undefined;
  let app: FastifyInstance | undefined;
  let metrics: Server | undefined;
  let controlProducer: { disconnect(): Promise<void> } | undefined;
  let closing: Promise<void> | undefined;
  const simulatorState: { current: SimulatorDriverState | null } = { current: null };
  const close = () => closing ??= (async () => {
    if (simulatorState.current) simulatorState.current = await stopSimulator(simulatorState.current);
    await app?.close();
    await controlProducer?.disconnect();
    await runtime?.stop();
    await projector?.stop();
    if (metrics) await new Promise<void>((resolve, reject) => metrics!.close(err => err ? reject(err) : resolve()));
    await lock.query("SELECT pg_advisory_unlock(713110)");
    lock.release();
    await pool.end();
  })();
  try {
    if (!(await lock.query("SELECT pg_try_advisory_lock(713110) AS locked")).rows[0]?.locked) throw new Error("Another API/control plane already owns this database");
    await runMigrations(pool, fileURLToPath(new URL("../../journal/migrations/", import.meta.url)));
    const sql = createSqlExecutor(pool);
    const instruments = new Map(startup.instruments.map(i => [i.symbol, i]));
    runtime = await createLiveRuntime({ sql, instruments, queueCapacity: startup.QUEUE_CAPACITY,
      maxBatch: startup.MAX_BATCH, heartbeatMs: startup.HEARTBEAT_MS, transport: startup.TRANSPORT, brokers: startup.KAFKA_BROKERS.split(","), shardPartitions: startup.SHARD_PARTITIONS,
      onFatal: error => { console.error("Fatal runtime failure", error); process.exitCode = 1; void close().catch(console.error); },
    });
    if (startup.SEED_DEMO === "1" || config.PROFILE === "demo") {
      const { seedDemo } = await import("./demo/seed.js");
      await seedDemo(sql, runtime, [...instruments.keys()]);
    }
    const simulatorUser = config.PROFILE === "demo"
      ? await sql.query("SELECT user_id FROM users WHERE username=$1", ["demo-simulator"])
      : undefined;
    const simulatorUserId = simulatorUser?.rows[0]
      ? String((simulatorUser.rows[0] as { user_id: string }).user_id)
      : undefined;
    if (startup.REBUILD_PROJECTIONS === "1") await sql.transaction(async tx => {
      await tx.query("TRUNCATE orders_view,order_fills,resting_orders,trades_view,balances_view,positions_view,reservations_view,rejections_view,breaker_view,projection_checkpoints");
    });
    const streams = ["risk-0", ...instruments.keys()];
    projector = new Projector({ executor: sql, noticeBus: new NoticeBus(), chunkSize: config.PROJECTOR_CHUNK,
      pollMs: config.PROJECTOR_POLL_MS, streamIds: streams });
    for (const stream of streams) while (await projector.runOnce(stream)) { /* catch up before serving */ }
    await projector.start();
    app = await buildApp({ config, executor: sql, facade: runtime, riskConfig: runtime.riskConfig,
      heartbeatMs: startup.HEARTBEAT_MS, prometheusUrl: startup.PROMETHEUS_URL, simulatorRateCap: startup.SIMULATOR_RATE_CAP,
      instruments: startup.instruments.map(spec => ({ symbol: spec.symbol, tick: spec.tickSize.toString(), lot: spec.lotSize.toString(), spec })), simulatorState,
      simulatorTicksPerSec: startup.SIMULATOR_TICKS_PER_SEC,
      simulatorUserId,
      commandRouter: startup.TRANSPORT === "kafka" && config.PROFILE === "demo" ? await (async () => {
        const { TransactionalProducer } = await import("@matchledger/transport");
        const producer = new TransactionalProducer({ brokers: startup.KAFKA_BROKERS.split(","), transactionalId: "api-demo-control" });
        await producer.init();
        controlProducer = producer;
        return { producer, brokers: startup.KAFKA_BROKERS.split(","), shardPartitions: startup.SHARD_PARTITIONS };
      })() : undefined });
    metrics = await startMetricsServer({ port: config.METRICS_PORT, host: startup.METRICS_HOST });
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    if (config.PROFILE === "demo") {
      const token = await signToken({ secret: new TextEncoder().encode(config.JWT_SECRET), ttlSeconds: config.JWT_TTL_SECONDS }, "demo-admin", "ADMIN");
      const response = await app.inject({ method: "POST", url: "/system/simulator/start", headers: { authorization: `Bearer ${token}` } });
      if (response.statusCode !== 200) throw new Error(`Demo simulator startup failed: HTTP ${response.statusCode}`);
      console.log("Demo simulator started; generated orders use the normal validated submission path");
    }
    console.log(`MatchLedger API ready at http://localhost:${config.PORT} (${startup.TRANSPORT}, ${config.PROFILE})`);
    return { app, close, graceMs: startup.SHUTDOWN_GRACE_MS };
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startApi().then(handle => {
    let stopping = false;
    const shutdown = (failed = false) => {
      if (stopping) { process.exit(1); }
      stopping = true;
      const timer = setTimeout(() => process.exit(1), handle.graceMs);
      timer.unref();
      void handle.close().then(() => { clearTimeout(timer); process.exitCode = failed ? 1 : 0; }, error => { console.error(error); process.exit(1); });
    };
    process.on("SIGTERM", () => shutdown());
    process.on("SIGINT", () => shutdown());
    process.on("unhandledRejection", error => { console.error(error); shutdown(true); });
    process.on("uncaughtException", error => { console.error(error); shutdown(true); });
  }).catch(error => { console.error("API startup failed", error); process.exitCode = 1; });
}
