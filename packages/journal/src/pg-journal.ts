/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from "pg";
import type { JournalAppender, JournalReader, ShardOutput } from "@matchledger/common";
import { toSafeNumber } from "./pool.js";

export class JournalSequenceError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "JournalSequenceError";
  }
}

export class JournalConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "JournalConflictError";
  }
}

export class PgJournal implements JournalAppender, JournalReader {
  constructor(private readonly pool: Pool, readonly writerEpoch: number) {}

  async append(batch: readonly unknown[]): Promise<void> {
    if (batch.length === 0) return;

    const bySeq = new Map<string, number>();
    for (const item of batch as any[]) {
      const last = bySeq.get(item.symbol) ?? 0;
      if (item.seq <= last) throw new JournalSequenceError(`dup/gap seq in batch for ${item.symbol}`);
      bySeq.set(item.symbol, item.seq);
    }

    const values: unknown[] = [];
    const rows: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i] as any;
      values.push(item.symbol, item.seq, "COMMAND", 0, 1, item.ts, this.writerEpoch, JSON.stringify(item.command));
      rows.push(`($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`);
    }
    const sql = "INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json) VALUES " + rows.join(",");

    try {
      await this.pool.query(sql, values);
    } catch (error) {
      throw new JournalConflictError(String(error));
    }
  }

  async appendEvents(batch: readonly ShardOutput[]): Promise<void> {
    if (batch.length === 0) return;

    const values: unknown[] = [];
    let sql = "INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json) VALUES ";
    let idx = 0;
    const rows: string[] = [];

    for (const output of batch) {
      for (let i = 0; i < output.events.length; i++) {
        values.push(output.symbol, output.seq, "EVENT", i, 1, output.ts, this.writerEpoch, JSON.stringify(output.events[i]));
        rows.push(`($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`);
        idx++;
      }
    }

    if (rows.length === 0) return;
    sql += rows.join(",") + " ON CONFLICT DO NOTHING";
    await this.pool.query(sql, values);
  }

  async lastCommandSeq(symbol: string): Promise<number> {
    const result = await this.pool.query(
      "SELECT MAX(seq) as max_seq FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND'",
      [symbol],
    );
    const max = (result.rows[0] as any)?.max_seq;
    return max ? toSafeNumber(max) : 0;
  }

  async readCommands(
    symbol: string,
    fromSeq: number,
    chunkSize: number,
  ): Promise<readonly { seq: number; ts: number; command: unknown }[]> {
    const result = await this.pool.query(
      "SELECT seq, ts, payload_json as command FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND' AND seq > $2 ORDER BY seq LIMIT $3",
      [symbol, fromSeq, chunkSize],
    );
    return result.rows.map((row: any) => ({
      seq: toSafeNumber(row.seq),
      ts: toSafeNumber(row.ts),
      command: row.command,
    }));
  }

  async readEvents(
    symbol: string,
    fromSeq: number,
    toSeq: number,
  ): Promise<readonly { seq: number; ts: number; payload: unknown }[]> {
    const result = await this.pool.query(
      "SELECT seq, ts, payload_json as payload FROM journal WHERE stream_id = $1 AND record_type = 'EVENT' AND seq >= $2 AND seq <= $3 ORDER BY seq, idx",
      [symbol, fromSeq, toSeq],
    );
    return result.rows.map((row: any) => ({
      seq: toSafeNumber(row.seq),
      ts: toSafeNumber(row.ts),
      payload: row.payload,
    }));
  }
}
