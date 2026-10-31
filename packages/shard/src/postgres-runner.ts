import { Engine, type InstrumentConfig, type Command } from "@matchledger/engine-core";
import { LeaseStore, FencedWriterError, type SqlExecutor } from "@matchledger/journal";
import { deserializeCommand, deserializeEvent, serializeEvent, type ShardOutput, type StampedCommand } from "@matchledger/common";
import { ShardRunner } from "./shard-runner.js";

export const journalJson = (value: unknown): string => JSON.stringify(value, (_, v: unknown) => typeof v === "bigint" ? v.toString() : v);

export function decodeEngineCommand(value: unknown, ts: number): Command {
  const payload = value as Record<string, unknown>;
  if (!payload.kind) return { ...deserializeCommand(JSON.stringify(payload)), ts: BigInt(ts) } as Command;
  if (payload.kind === "PLACE") return { ...payload, ts: BigInt(ts), price: BigInt(String(payload.price)), quantity: BigInt(String(payload.quantity)) } as Command;
  return { ...payload, ts: BigInt(ts) } as Command;
}

/** Recover and fence a real matching runner. No writes occur before the lease. */
export async function createPostgresRunner(options: {
  sql: SqlExecutor; symbols: ReadonlyMap<string, InstrumentConfig>; leaseId: string; owner: string;
  queueCapacity: number; maxBatch: number; onOutputs: (outputs: readonly ShardOutput[]) => Promise<void>;
  onFatal: (error: unknown) => void;
}) {
  const { sql, leaseId } = options;
  const epoch = await new LeaseStore(sql).acquire(leaseId, options.owner);
  const started = Date.now();
  const streams = new Map<string, { book: Engine; lastSeq: number; lastTs: number }>();
  const sequences = new Map<string, number>();
  let lastTs = 0;
  let replayed = 0;
  for (const [symbol, spec] of options.symbols) {
    const book = new Engine(spec);
    const rows = await sql.query("SELECT seq, ts, payload_json FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND' ORDER BY seq", [symbol]);
    let seq = 0;
    for (const row of rows.rows) {
      if (Number(row.seq) !== seq + 1) throw new Error(`Journal gap in ${symbol}`);
      seq = Number(row.seq);
      const ts = Number(row.ts);
      const events = book.apply(decodeEngineCommand(row.payload_json, ts));
      const stored = await sql.query("SELECT payload_json FROM journal WHERE stream_id=$1 AND seq=$2 AND record_type='EVENT' ORDER BY idx", [symbol, seq]);
      if (stored.rows.length) {
        const actual = stored.rows.map(r => serializeEvent(deserializeEvent(JSON.stringify(r.payload_json))));
        if (JSON.stringify(actual) !== JSON.stringify(events.map(serializeEvent))) throw new Error(`Replay mismatch in ${symbol}:${seq}`);
      } else if (events.length) {
        await sql.transaction(async tx => {
          const lease = await tx.query("SELECT epoch FROM shard_leases WHERE lease_id=$1 FOR SHARE", [leaseId]);
          if (BigInt(lease.rows[0]?.epoch ?? -1) !== epoch) throw new FencedWriterError(`Lost ${leaseId} during recovery`);
          for (const [idx, event] of events.entries()) {
            await tx.query("INSERT INTO journal (stream_id,seq,record_type,idx,schema_version,ts,writer_epoch,payload_json) VALUES ($1,$2,'EVENT',$3,1,$4,$5,$6)", [symbol, seq, idx, ts, epoch, journalJson(event)]);
          }
        });
      }
      lastTs = Math.max(lastTs, ts);
      replayed++;
    }
    const issues = book.checkInvariants();
    if (issues.length) throw new Error(`Recovered book invariants: ${issues.join(", ")}`);
    streams.set(symbol, { book, lastSeq: seq, lastTs });
    sequences.set(symbol, seq);
  }
  const fenced = async (fn: (tx: SqlExecutor) => Promise<void>) => sql.transaction(async tx => {
    const lease = await tx.query("SELECT epoch FROM shard_leases WHERE lease_id = $1 FOR SHARE", [leaseId]);
    if (!lease.rows[0] || BigInt(lease.rows[0].epoch) !== epoch) throw new FencedWriterError(`Lost ${leaseId}`);
    await fn(tx);
  });
  const appendEvents = async (outputs: readonly ShardOutput[]) => fenced(async tx => {
    for (const output of outputs) {
      for (const [idx, event] of output.events.entries()) {
        await tx.query("INSERT INTO journal (stream_id,seq,record_type,idx,schema_version,ts,writer_epoch,payload_json) VALUES ($1,$2,'EVENT',$3,1,$4,$5,$6) ON CONFLICT DO NOTHING",
          [output.symbol, output.seq, idx, output.ts, epoch, journalJson(event)]);
      }
    }
  });
  const runner = new ShardRunner({
    symbols: options.symbols, queueCapacity: options.queueCapacity, maxBatch: options.maxBatch,
    clock: { now: () => Date.now() }, recovered: { streams, lastSeqBySymbol: sequences, lastTs },
    journal: { append: async (batch: readonly unknown[]) => fenced(async tx => {
      for (const item of batch as readonly StampedCommand[]) {
        await tx.query("INSERT INTO journal (stream_id,seq,record_type,idx,schema_version,ts,writer_epoch,payload_json) VALUES ($1,$2,'COMMAND',0,1,$3,$4,$5)",
          [item.symbol, item.seq, item.ts, epoch, journalJson(item.command)]);
      }
    }) },
    sink: { publish: async outputs => { await appendEvents(outputs); await options.onOutputs(outputs); } },
    onFatal: options.onFatal,
  });
  const heartbeat = () => sql.query("INSERT INTO shard_heartbeats (lease_id,last_seq,owned_symbols) VALUES ($1,$2,$3) ON CONFLICT (lease_id) DO UPDATE SET last_heartbeat_at=now(),last_seq=$2,owned_symbols=$3,updated_at=now()",
    [leaseId, Math.max(0, ...sequences.values()), [...options.symbols.keys()]]);
  await heartbeat();
  await sql.query("INSERT INTO recovery_log (lease_id,started_at,completed_at,duration_ms,snapshot_seq,tail_length,symbols_recovered) VALUES ($1,$2,now(),$3,0,$4,$5)",
    [leaseId, new Date(started), Date.now() - started, replayed, [...options.symbols.keys()]]);
  return { runner, epoch, heartbeat, sequences, books: streams };
}
