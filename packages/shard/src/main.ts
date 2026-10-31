import { z } from "zod";
import { fileURLToPath } from "node:url";
import { Engine, type InstrumentConfig } from "@matchledger/engine-core";
import { createPool, createSqlExecutor, runMigrations, LeaseStore } from "@matchledger/journal";
import { PartitionConsumer, TransactionalProducer, createDeadLetterMessage, checkTopics, type ConsumerMessage } from "@matchledger/transport";
import { partitionOf } from "@matchledger/common";
import { ShardHost } from "./shard-host.js";
import { startMetricsServer } from "@matchledger/telemetry";
import { startStallWatchdog } from "./stall-watchdog.js";
import { ShardRunner } from "./shard-runner.js";
import { decodeEngineCommand, journalJson } from "./postgres-runner.js";

export async function startShard() {
  const config = z.object({
    SHARD_ID: z.string().min(1), TRANSPORT: z.literal("kafka"),
    DATABASE_URL: z.string().url(), KAFKA_BROKERS: z.string().default("localhost:29092"),
    SHARD_PARTITIONS: z.coerce.number().int().positive().default(4),
    SHARD_GROUP_ID: z.string().min(1).default("matchledger-shards"),
    QUEUE_CAPACITY: z.coerce.number().int().positive().default(1000), MAX_BATCH: z.coerce.number().int().positive().default(100),
    SESSION_TIMEOUT_MS: z.coerce.number().int().min(6000).default(10000),
    MAX_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(300000),
    METRICS_PORT: z.coerce.number().int().min(0).max(65535).default(0),
    HEARTBEAT_MS: z.coerce.number().int().positive().default(5000), PROFILE: z.enum(["demo", "prod"]).default("prod"),
  }).parse(process.env);
  const raw: unknown = process.env.INSTRUMENTS_JSON ? JSON.parse(process.env.INSTRUMENTS_JSON) : ["ACME", "BOBO"].map(symbol => ({ symbol, tickSize: "1", lotSize: "1", maxQuantity: "1000000", maxPrice: "1000000" }));
  const positive = z.string().regex(/^[1-9][0-9]*$/).transform(BigInt);
  const specs = z.array(z.object({ symbol: z.string().min(1), tickSize: positive, lotSize: positive, maxQuantity: positive, maxPrice: positive })).min(1).parse(raw);
  const instruments = new Map<string, InstrumentConfig>(specs.map(spec => [spec.symbol, spec]));
  const pool = createPool({ connectionString: config.DATABASE_URL });
  const sql = createSqlExecutor(pool);
  const brokers = config.KAFKA_BROKERS.split(",");
  const consumer = new PartitionConsumer({ brokers, groupId: config.SHARD_GROUP_ID, groupInstanceId: config.SHARD_ID, sessionTimeoutMs: config.SESSION_TIMEOUT_MS, maxPollIntervalMs: config.MAX_POLL_INTERVAL_MS, onAssignmentLost: () => fail(new Error("Kafka assignment lost; zombie must exit")) });
  const dlq = new TransactionalProducer({ brokers, transactionalId: `dlq-${config.SHARD_ID}` });
  const recovered = new Map<string, { book: Engine; lastSeq: number; lastTs: number }>();
  const initializing = new Map<number, Promise<void>>();
  const active = new Set<number>();
  let stopping = false;
  let monitor: ReturnType<typeof setInterval> | undefined;
  let metrics: Awaited<ReturnType<typeof startMetricsServer>> | undefined;
  let stopWatchdog: (() => Promise<void>) | undefined;
  let control: PartitionConsumer | undefined;

  const fail = (error: unknown) => { console.error("Shard fail-stop", error); process.exit(1); };
  const host = new ShardHost({ pool, consumer, leaseStore: new LeaseStore(sql), brokers, shardId: config.SHARD_ID,
    heartbeatMs: config.HEARTBEAT_MS,
    deadLetter: async (msg, error) => {
      await dlq.sendBatch(`dlq.${msg.topic}`, [{ key: msg.key ?? "invalid", partition: msg.partition,
        value: createDeadLetterMessage({ topic: msg.topic, partition: msg.partition, offset: msg.offset,
          error: error instanceof Error ? error.message : String(error), rawBytes: msg.value, timestamp: Date.now() }) }]);
    },
    recoverSymbol: async symbol => {
      const spec = instruments.get(symbol);
      if (!spec) throw new Error(`Unknown configured symbol ${symbol}`);
      const book = new Engine(spec);
      let seq = 0, lastTs = 0;
      const rows = await sql.query("SELECT seq,ts,payload_json FROM journal WHERE stream_id=$1 AND record_type='COMMAND' ORDER BY seq", [symbol]);
      for (const row of rows.rows) {
        if (Number(row.seq) !== ++seq) throw new Error(`Journal gap in ${symbol}`);
        lastTs = Number(row.ts);
        const events = book.apply(decodeEngineCommand(row.payload_json, lastTs));
        for (const [idx, event] of events.entries()) {
          await sql.query("INSERT INTO journal (stream_id,seq,record_type,idx,schema_version,ts,writer_epoch,payload_json) SELECT $1,$2,'EVENT',$3,1,$4,epoch,$5 FROM shard_leases WHERE lease_id=$6 AND owner=$7 ON CONFLICT DO NOTHING", [symbol, seq, idx, lastTs, journalJson(event), `shard-${partitionOf(symbol, config.SHARD_PARTITIONS)}`, config.SHARD_ID]);
        }
      }
      if (book.checkInvariants().length) throw new Error(`Invalid recovered book ${symbol}`);
      recovered.set(symbol, { book, lastSeq: seq, lastTs });
      return { lastSeq: seq, tailLength: rows.rows.length };
    },
    runnerFactory: (partition, symbols, journal, sink) => {
      const streams = new Map(symbols.map(symbol => [symbol, recovered.get(symbol)!]));
      const runner = new ShardRunner({ symbols: new Map(symbols.map(symbol => [symbol, instruments.get(symbol)!])),
        clock: { now: () => Date.now() }, queueCapacity: config.QUEUE_CAPACITY, maxBatch: config.MAX_BATCH,
        recovered: { streams, lastSeqBySymbol: new Map([...streams].map(([s, state]) => [s, state.lastSeq])), lastTs: Math.max(0, ...[...streams.values()].map(s => s.lastTs)) },
        journal: { append: batch => journal.append(batch, host.getOffsetTickets(partition)?.popBatch(batch.length)) },
        sink: { publish: async outputs => {
          await journal.appendEvents(outputs);
          await sink.publish(outputs);
          for (const output of outputs) await journal.upsertPublishedThrough(output.symbol, BigInt(output.seq));
        } },
        afterBatch: async ctx => { host.recordBatchMetrics(partition, ctx.lastSeqBySymbol); await host.resumeIfDrained(partition, 0); },
        onFatal: fail,
      });
      return { start: () => runner.start(), stop: () => runner.stop({ drain: false }),
        tryEnqueue: (value: Record<string, unknown>) => {
          const symbol = String(value.symbol ?? "");
          const payload = value.type === "OrderAccepted" ? { kind: "PLACE", ...value, orderType: value.timeInForce === "GTC" ? "LIMIT" : "IOC" }
            : value.type === "CancelOrder" ? { kind: "CANCEL", orderId: value.orderId } : value;
          return runner.tryEnqueue(symbol, decodeEngineCommand(payload, 0));
        } };
    },
  });
  const ensureAssigned = (partition: number) => {
    if (host.hasPartition(partition)) return Promise.resolve();
    const current = initializing.get(partition);
    if (current) return current;
    const symbols = specs.filter(s => partitionOf(s.symbol, config.SHARD_PARTITIONS) === partition).map(s => s.symbol);
    const pending = host.onAssign(partition, symbols).then(() => { active.add(partition); }).finally(() => initializing.delete(partition));
    initializing.set(partition, pending);
    return pending;
  };
  try {
    await runMigrations(pool, fileURLToPath(new URL("../../journal/migrations/", import.meta.url)));
    await checkTopics(brokers, ["orders.accepted", "control.commands", "engine.events", "dlq.orders.accepted"].map(name => ({ name, partitions: config.SHARD_PARTITIONS })));
    await dlq.init();
    await consumer.init();
    await consumer.assign("orders.accepted");
    await consumer.run(async (msg: ConsumerMessage) => {
      if (stopping) return;
      await ensureAssigned(msg.partition);
      await host.verifyOwnership();
      let parsed: { payload?: Record<string, unknown> } & Record<string, unknown>;
      try { parsed = JSON.parse(msg.value.toString()) as { payload?: Record<string, unknown> } & Record<string, unknown>; } catch { await host.onMessage(msg); return; }
      const command = parsed.payload ?? parsed;
      if (!instruments.has(String(command.symbol ?? msg.key))) return;
      const id = command.kind === "PLACE" || command.type === "OrderAccepted" ? String(command.orderId) : undefined;
      if (id) {
        const exists = await sql.query("SELECT 1 FROM journal WHERE record_type='COMMAND' AND stream_id=$1 AND payload_json->>'orderId'=$2", [command.symbol ?? msg.key, id]);
        if (exists.rows.length) return;
      }
      await host.onMessage(msg);
      // Keep consumer callbacks serial through durability so a redelivery cannot
      // enqueue the same order twice before its first command is committed.
      if (id) {
        const deadline = Date.now() + config.MAX_POLL_INTERVAL_MS;
        while (!(await sql.query("SELECT 1 FROM journal WHERE record_type='COMMAND' AND stream_id=$1 AND payload_json->>'orderId'=$2", [command.symbol ?? msg.key, id])).rows.length) {
          if (Date.now() > deadline) throw new Error("Matching command did not become durable");
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
    }, fail);
    metrics = await startMetricsServer({ port: config.METRICS_PORT, host: "0.0.0.0" });
    stopWatchdog = startStallWatchdog(config.MAX_POLL_INTERVAL_MS);
    if (config.PROFILE === "demo") {
      control = new PartitionConsumer({ brokers, groupId: `chaos-${config.SHARD_ID}`, groupInstanceId: `chaos-${config.SHARD_ID}`, fromBeginning: false });
      await control.init();
      await control.assign("control.commands");
      await control.run(async message => {
        const envelope = JSON.parse(message.value.toString()) as { payload?: { type?: string; symbol?: string; durationMs?: number } };
        const command = envelope.payload;
        if (!command?.symbol || !host.hasPartition(partitionOf(command.symbol, config.SHARD_PARTITIONS))) return;
        if (command.type === "KillShard") process.exit(1);
        if (command.type === "FreezeShard") {
          const duration = z.number().int().positive().max(60000).parse(command.durationMs);
          const until = Date.now() + duration;
          while (Date.now() < until) { /* demo-only genuine event-loop stall */ }
        }
      }, fail);
    }
    let syncing = false;
    monitor = setInterval(() => {
      if (syncing || stopping) return;
      syncing = true;
      void (async () => {
        const assigned = new Set(consumer.assignments().map(p => p.partition));
        for (const partition of active) if (!assigned.has(partition)) { await host.onRevoke([partition]); active.delete(partition); }
        await host.verifyOwnership();
        for (const partition of assigned) await ensureAssigned(partition);
      })().catch(fail).finally(() => { syncing = false; });
    }, 250);
    console.log(`Shard ${config.SHARD_ID} ready with real journal recovery and matching runners`);
    const close = async () => {
      stopping = true;
      if (monitor) clearInterval(monitor);
      await stopWatchdog?.();
      await control?.disconnect();
      if (metrics) await new Promise<void>((resolve, reject) => metrics!.close(error => error ? reject(error) : resolve()));
      await Promise.all(initializing.values());
      await host.shutdown();
      await consumer.disconnect();
      await dlq.disconnect();
      await pool.end();
    };
    return { close };
  } catch (error) { if (monitor) clearInterval(monitor); await stopWatchdog?.(); await control?.disconnect(); metrics?.close(); await consumer.disconnect().catch(() => {}); await dlq.disconnect().catch(() => {}); await pool.end(); throw error; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startShard().then(({ close }) => {
    let stopping = false;
    const stop = () => { if (stopping) process.exit(1); stopping = true; void close().catch(error => { console.error(error); process.exit(1); }); };
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
    process.on("unhandledRejection", error => { console.error(error); process.exit(1); });
    process.on("uncaughtException", error => { console.error(error); process.exit(1); });
  }).catch(error => { console.error(error); process.exit(1); });
}
