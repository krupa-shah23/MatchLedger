import type { SqlExecutor } from "@matchledger/journal";
import type { InstrumentConfig, Command } from "@matchledger/engine-core";
import { createPostgresRunner } from "@matchledger/shard";
import { RiskStamper, PgRiskJournal, recoverRiskPartition, EngineEventRouter, MarketView } from "@matchledger/risk";
import { acceptedToPlaceOrder, deserializeEvent, serializeEvent, deserializeRiskEvent, type RiskCommand, type RiskConfig, type ShardOutput } from "@matchledger/common";
import { TransactionalProducer, PartitionConsumer, encodeEnvelope, decodeEnvelope } from "@matchledger/transport";
import { partitionOf } from "@matchledger/common";
import { PgLedgerStore } from "@matchledger/ledger";
import { getOrCreateCounter } from "@matchledger/telemetry";

/** Single-process composition: durable risk commands -> matching runner -> notices.
 * Recovery uses the same risk/engine code as live execution. The process owns an
 * advisory lock, so two API instances cannot write the same risk partition. */
export async function createLiveRuntime(options: {
  sql: SqlExecutor; instruments: ReadonlyMap<string, InstrumentConfig>; queueCapacity: number;
  maxBatch: number; transport?: "inproc" | "kafka"; brokers?: string[]; shardPartitions?: number; heartbeatMs: number; onFatal: (error: unknown) => void;
}) {
  const { sql } = options;
  const mode = options.transport ?? "inproc";
  const sequences = new Map<string, number>();
  let matching: Awaited<ReturnType<typeof createPostgresRunner>> | undefined;
  let producer: TransactionalProducer | undefined;
  let consumer: PartitionConsumer | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
  if (mode === "kafka") {
    const brokers = options.brokers ?? ["localhost:29092"];
    producer = new TransactionalProducer({ brokers, transactionalId: "api-orders-accepted" });
    await producer.init();
    consumer = new PartitionConsumer({ brokers, groupId: "matchledger-control-plane", groupInstanceId: "api-control-plane", fromBeginning: true });
    await consumer.init();
    await consumer.assign("engine.events");
  }
  const riskConfig: RiskConfig = { instruments: new Map([...options.instruments].map(([symbol, spec]) => [symbol, {
    symbol, tickSize: spec.tickSize, maxPrice: spec.maxPrice, protectionBandBps: 500n,
    maxBandBps: 1000n, referencePriceTicks: 10000n / spec.tickSize, maxReferenceAgeMs: 60_000,
  }])) };
  const started = Date.now();
  const recovered = await recoverRiskPartition({ sql, partition: 0, config: riskConfig });
  const journal = await PgRiskJournal.create(sql, { partition: 0, writerEpoch: 1n });
  for (const output of recovered.regenerated) await journal.appendEvents([output]);
  const stamper = new RiskStamper({ now: () => Date.now() }, { cores: new Map([[0, recovered]]) });
  const router = new EngineEventRouter({ marketView: new MarketView() });
  const ledger = new PgLedgerStore(sql);
  const deposits = await sql.query("SELECT seq,payload_json FROM journal WHERE stream_id='risk-0' AND record_type='EVENT' AND payload_json->>'type'='FundsDeposited' ORDER BY seq", []);
  for (const row of deposits.rows) {
    const event = deserializeRiskEvent(JSON.stringify(row.payload_json));
    if (event.type !== "FundsDeposited" || event.amount === 0n) continue;
    await ledger.appendTx({ txId: `deposit:${event.requestId}`, refEventId: `risk-0:${row.seq}`, legs: [
      { accountId: event.accountId, asset: event.asset, amount: event.amount },
      { accountId: "@EXTERNAL", asset: event.asset, amount: -event.amount },
    ] });
  }
  const owners = await sql.query("SELECT order_id,account_id,symbol,side FROM order_owners", []);
  router.restoreOwners(owners.rows.map(row => ({ orderId: row.order_id, accountId: row.account_id, symbol: row.symbol, side: row.side })));
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let closed = false;
  let fatal: unknown;
  const fail = (error: unknown) => { fatal = error; options.onFatal(error); };

  async function risk(command: RiskCommand) {
    const stamped = stamper.stamp(0, command);
    await journal.append([stamped]);
    const events = recovered.core.apply(stamped);
    await journal.appendEvents([{ ...stamped, events }]);
    for (const event of events) {
      if (event.type === "OrderAccepted") getOrCreateCounter("ml_risk_decisions_total").inc({ outcome: "accepted" });
      if (event.type === "OrderRejected") {
        getOrCreateCounter("ml_risk_decisions_total").inc({ outcome: "rejected" });
        getOrCreateCounter("ml_risk_rejections_total").inc({ reason: event.reason });
      }
      if (event.type === "OrderAccepted") {
        router.registerOrder(event.orderId, { accountId: event.accountId, symbol: event.symbol, side: event.side });
        const engineCommand = { ...acceptedToPlaceOrder(event), orderType: event.timeInForce === "GTC" ? "LIMIT" as const : "IOC" as const };
        await enqueue(event.symbol, engineCommand);
      }
      if (event.type === "FundsDeposited" && event.amount !== 0n) {
        await ledger.appendTx({ txId: `deposit:${event.requestId}`, refEventId: `risk-0:${stamped.seq}`, legs: [
          { accountId: event.accountId, asset: event.asset, amount: event.amount },
          { accountId: "@EXTERNAL", asset: event.asset, amount: -event.amount },
        ] });
      }
    }
  }
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    if (closed || fatal) return Promise.reject(fatal ?? new Error("Runtime closed"));
    const result = tail.then(fn);
    tail = result.catch(fail);
    return result;
  }
  async function enqueue(symbol: string, command: Command) {
    if (producer) {
      await producer.sendBatch("orders.accepted", [{ key: symbol, partition: partitionOf(symbol, options.shardPartitions ?? 4),
        value: encodeEnvelope({ schemaVersion: 1, msgId: `${symbol}:${command.kind}:${"orderId" in command ? command.orderId : "tick"}`, type: "MatchingCommand", payload: { ...command, symbol } }) }]);
      return;
    }
    if (!matching) throw new Error("Matching runtime has not started");
    for (;;) {
      const result = matching.runner.tryEnqueue(symbol, command);
      if (result === "ACCEPTED") return;
      if (result !== "FULL") throw new Error(`Matching enqueue: ${result}`);
      if (fatal) throw fatal;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
  async function outputs(batch: readonly ShardOutput[]) {
    const routed = router.onShardOutputs(batch);
    for (const notice of routed.notices) await serial(() => risk(notice.command));
    for (const trade of routed.trades) {
      const value = trade.price * trade.quantity;
      await ledger.appendTx({ txId: `trade:${trade.tradeId}`, refEventId: trade.tradeId, legs: [
        { accountId: trade.buyerAccountId, asset: "CASH", amount: -value },
        { accountId: trade.sellerAccountId, asset: "CASH", amount: value },
        { accountId: trade.buyerAccountId, asset: trade.symbol, amount: trade.quantity },
        { accountId: trade.sellerAccountId, asset: trade.symbol, amount: -trade.quantity },
      ] });
    }
    for (const output of batch) sequences.set(output.symbol, output.seq);
  }
  if (mode === "inproc") matching = await createPostgresRunner({ ...options, symbols: options.instruments, leaseId: "inproc-engine", owner: `api-${process.pid}`, onOutputs: outputs });
  // Apply persisted outputs to restore market data and catch up risk notices.
  for (const symbol of options.instruments.keys()) {
    const rows = await sql.query("SELECT seq,ts,payload_json FROM journal WHERE stream_id=$1 AND record_type='EVENT' ORDER BY seq,idx", [symbol]);
    const grouped = new Map<number, ShardOutput>();
    for (const row of rows.rows) {
      const seq = Number(row.seq);
      const current = grouped.get(seq) ?? { symbol, seq, ts: Number(row.ts), command: {} as Command, events: [] };
      grouped.set(seq, { ...current, events: [...current.events, deserializeEvent(JSON.stringify(row.payload_json))] });
    }
    await outputs([...grouped.values()]);
  }
  matching?.runner.start();
  if (consumer) await consumer.run(async message => {
    const envelope = decodeEnvelope(message.value.toString());
    if (envelope.type !== "ShardOutput") throw new Error("Unexpected engine event envelope");
    const output = envelope.payload as ShardOutput;
    if (!options.instruments.has(output.symbol)) return;
    const durable = await sql.query("SELECT payload_json FROM journal WHERE stream_id=$1 AND seq=$2 AND record_type='EVENT' ORDER BY idx", [output.symbol, output.seq]);
    // A reused broker may retain another database's historical traffic. Only
    // route output that agrees with this database's actual durable journal.
    const stored = durable.rows.map(row => serializeEvent(deserializeEvent(JSON.stringify(row.payload_json))));
    if (JSON.stringify(stored) !== JSON.stringify(output.events.map(serializeEvent))) return;
    if ((sequences.get(output.symbol) ?? 0) >= output.seq) return;
    await outputs([output]);
  }, fail);
  // Redeliver accepted orders whose matching command was not journaled at crash.
  const accepted = await sql.query("SELECT payload_json FROM journal WHERE stream_id='risk-0' AND record_type='EVENT' AND payload_json->>'type'='OrderAccepted' ORDER BY seq,idx", []);
  for (const row of accepted.rows) {
    const event = deserializeRiskEvent(JSON.stringify(row.payload_json));
    if (event.type !== "OrderAccepted") continue;
    const existing = await sql.query("SELECT 1 FROM journal WHERE stream_id=$1 AND record_type='COMMAND' AND payload_json->>'orderId'=$2", [event.symbol, event.orderId]);
    if (!existing.rows.length) await enqueue(event.symbol, { ...acceptedToPlaceOrder(event), orderType: event.timeInForce === "GTC" ? "LIMIT" : "IOC" });
  }
  heartbeat = setInterval(() => void matching?.heartbeat().catch(fail), options.heartbeatMs);
  await sql.query("INSERT INTO recovery_log (lease_id,started_at,completed_at,duration_ms,snapshot_seq,tail_length,symbols_recovered) VALUES ('risk-0',$1,now(),$2,$3,$4,$5)",
    [new Date(started), Date.now() - started, recovered.snapshotUsed?.lastSeq ?? 0, recovered.replayed, [...options.instruments.keys()]]);
  await sql.query("INSERT INTO recovery_log (lease_id,started_at,completed_at,duration_ms,snapshot_seq,tail_length,symbols_recovered) VALUES ('control-plane',$1,now(),$2,0,$3,$4)",
    [new Date(started), Date.now() - started, [...sequences.values()].reduce((a,b) => a+b, 0), [...options.instruments.keys()]]);
  return {
    riskConfig,
    async hasSubmitCommand(id: string) { return journal.hasSubmit(id); },
    async submitOrder(value: unknown): Promise<{ kind: "FULL" | "JOURNALED" }> {
      if (pending >= options.queueCapacity) return { kind: "FULL" };
      pending++;
      try {
        await serial(async () => {
          const command = value as Extract<RiskCommand, { type: "SubmitOrder" }>;
          await risk({ ...command, price: command.price ?? undefined, market: router.marketView.snapshotFor(command.symbol) });
        });
        return { kind: "JOURNALED" };
      } finally { pending--; }
    },
    async cancelOrder(symbol: string, orderId: string) { await enqueue(symbol, { kind: "CANCEL", orderId, ts: 0n }); },
    async haltSymbol(symbol: string, reason: string) { await serial(() => risk({ type: "HaltSymbol", symbol, reason })); },
    async resumeSymbol(symbol: string) { await serial(() => risk({ type: "ResumeSymbol", symbol })); },
    async deposit(accountId: string, asset: string, amount: bigint, requestId: string) {
      await serial(async () => {
        if (!recovered.core.accounts.has(accountId)) await risk({ type: "OpenAccount", accountId });
        await risk({ type: "Deposit", accountId, asset, amount, requestId });
      });
    },
    async riskView(accountId: string) { return recovered.core.view(accountId); },
    async internalTrades(fromTs: number, toTs: number) { return (await sql.query("SELECT * FROM trades_view WHERE ts >= $1 AND ts <= $2", [fromTs, toTs])).rows; },
    async stop() { clearInterval(heartbeat); await tail; await matching?.runner.stop({ drain: true }); await consumer?.disconnect(); await tail; await producer?.disconnect(); closed = true; },
  };
  } catch (error) {
    if (heartbeat) clearInterval(heartbeat);
    await matching?.runner.stop({ drain: false }).catch(() => undefined);
    await consumer?.disconnect().catch(() => undefined);
    await producer?.disconnect().catch(() => undefined);
    throw error;
  }

}
