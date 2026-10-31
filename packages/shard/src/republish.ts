import type { EventSink, ShardOutput } from "@matchledger/common";
import { deserializeEvent } from "@matchledger/common";
import type { Pool } from "pg";
import { decodeEngineCommand } from "./postgres-runner.js";

/** Reconstruct complete outputs from the actual per-event journal rows. */
export async function republish(pool: Pool, sink: EventSink, symbols: readonly string[], leaseId: string): Promise<void> {
  const watermarks = await pool.query("SELECT symbol, seq FROM published_through WHERE lease_id = $1", [leaseId]);
  const through = new Map(watermarks.rows.map(row => [row.symbol as string, BigInt(row.seq)]));
  for (const symbol of symbols) {
    const rows = await pool.query(`SELECT e.seq,e.ts,e.payload_json,c.payload_json AS command
      FROM journal e JOIN journal c ON c.stream_id=e.stream_id AND c.seq=e.seq AND c.record_type='COMMAND'
      WHERE e.stream_id=$1 AND e.record_type='EVENT' AND e.seq>$2 ORDER BY e.seq,e.idx`, [symbol, through.get(symbol) ?? 0n]);
    const grouped = new Map<number, ShardOutput>();
    for (const row of rows.rows) {
      const seq = Number(row.seq), ts = Number(row.ts);
      const current = grouped.get(seq) ?? { symbol, seq, ts, command: decodeEngineCommand(row.command, ts), events: [] };
      grouped.set(seq, { ...current, events: [...current.events, deserializeEvent(JSON.stringify(row.payload_json))] });
    }
    if (grouped.size) await sink.publish([...grouped.values()]);
  }
}
