/**
 * Republish: send EVENT rows with seq > published_through in one transaction.
 * Called during recovery (step 4 of ownership lifecycle) before the runner starts.
 * Ensures that if a crash happened between Kafka commit and published_through upsert,
 * the lost events are resent in the next epoch (duplicates handled by consumer deduping on symbol:seq).
 *
 * Contract: republish events for each symbol in the partition that have seq > published_through.
 */

import type { ShardOutput } from "@matchledger/common";
import type { EventSink } from "@matchledger/common";
import type { Pool } from "pg";

/**
 * Republish EVENT rows from the engine journal with seq > published_through per symbol.
 * The sink publishes these as ShardOutput entries (transactional to Kafka).
 *
 * @param pool - PostgreSQL pool for reading published_through and engine journal
 * @param sink - EventSink to publish recovered events
 * @param symbols - Symbols owned by this partition
 * @param leaseId - Lease ID (shard-<partition>) to look up published_through
 */
export async function republish(
  pool: Pool,
  sink: EventSink,
  symbols: readonly string[],
  leaseId: string
): Promise<void> {
  // Read published_through watermarks for this partition
  const watermarkRows = await pool.query(
    "SELECT symbol, seq FROM published_through WHERE lease_id = $1",
    [leaseId]
  );

  const watermarks = new Map<string, bigint>();
  for (const row of watermarkRows.rows) {
    watermarks.set((row as any).symbol, BigInt((row as any).seq));
  }

  // For each symbol, read and republish EVENT rows with seq > published_through
  const eventsBySymbol = new Map<string, ShardOutput[]>();

  for (const symbol of symbols) {
    const publishedThrough = watermarks.get(symbol) ?? 0n;

    // Read EVENT rows from the engine journal for this symbol with seq > published_through
    const eventRows = await pool.query(
      `SELECT seq, ts, payload_json
       FROM journal
       WHERE stream_id = $1 AND record_type = 'EVENT' AND seq > $2
       ORDER BY seq ASC`,
      [symbol, publishedThrough]
    );

    const events: ShardOutput[] = [];
    for (const row of eventRows.rows) {
      const payload = (row as any).payload_json;
      const ts = (row as any).ts;
      const tsMs = (ts instanceof Date ? ts.getTime() : new Date(ts).getTime()) as number;
      events.push({
        symbol,
        seq: Number((row as any).seq),
        ts: tsMs,
        command: payload.command ?? {},
        events: payload.events ?? [],
      });
    }

    if (events.length > 0) {
      eventsBySymbol.set(symbol, events);
    }
  }

  // Publish all recovered events per symbol
  for (const [_symbol, events] of eventsBySymbol) {
    if (events.length > 0) {
      await sink.publish(events);
    }
  }
}
