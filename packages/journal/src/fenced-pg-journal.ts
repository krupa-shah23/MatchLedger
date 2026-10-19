/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SqlExecutor } from "./sql-executor.js";
import type { JournalAppender, ShardOutput } from "@matchledger/common";

export class FencedWriterError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "FencedWriterError";
  }
}

export interface OffsetTicket {
  topic: string;
  partition: number;
  offset: bigint;
}

// Hand-written fenced append per WEEK-10.md 4.5
export class FencedPgJournal implements JournalAppender {
  constructor(
    private sql: SqlExecutor,
    readonly leaseId: string,
    readonly myEpoch: bigint
  ) {}

  async append(batch: readonly unknown[], offsets?: readonly OffsetTicket[]): Promise<void> {
    if (batch.length === 0) return;

    const items = batch as any[];

    // Collect command rows
    const streamIds: string[] = [];
    const seqs: number[] = [];
    const tss: number[] = [];
    const payloads: string[] = [];

    for (const item of items) {
      streamIds.push(item.symbol);
      seqs.push(item.seq);
      tss.push(item.ts);
      payloads.push(JSON.stringify(item.command));
    }

    // Use a CTE with FOR SHARE to enforce fencing
    const sql = `
      WITH lease AS (
        SELECT epoch FROM shard_leases WHERE lease_id = $1 FOR SHARE
      )
      INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json)
      SELECT u.stream_id, u.seq, 'COMMAND'::text, 0, 1, u.ts, $2, u.payload::jsonb
      FROM unnest($3::text[], $4::integer[], $5::integer[], $6::text[])
        AS u(stream_id, seq, ts, payload)
      CROSS JOIN (SELECT epoch FROM lease)
      WHERE epoch = $2
    `;

    const result = await this.sql.query(sql, [this.leaseId, Number(this.myEpoch), streamIds, seqs, tss, payloads]);

    if (result.rowCount !== batch.length) {
      const leaseResult = await this.sql.query("SELECT epoch FROM shard_leases WHERE lease_id = $1", [this.leaseId]);
      if (leaseResult.rows.length > 0) {
        const currentEpoch = BigInt(String((leaseResult.rows[0] as any).epoch));
        if (currentEpoch !== this.myEpoch) {
          throw new FencedWriterError(`Lease epoch mismatch: my epoch ${this.myEpoch}, current ${currentEpoch}`);
        }
      } else {
        throw new FencedWriterError("Lease not found");
      }
    }

    // Upsert offsets if provided
    if (offsets && offsets.length > 0) {
      for (const offset of offsets) {
        await this.upsertOffset(offset.topic, offset.partition, offset.offset);
      }
    }
  }

  async appendEvents(batch: readonly ShardOutput[]): Promise<void> {
    if (batch.length === 0) return;

    const streamIds: string[] = [];
    const seqs: number[] = [];
    const idxs: number[] = [];
    const tss: number[] = [];
    const payloads: string[] = [];

    for (const output of batch) {
      for (let i = 0; i < output.events.length; i++) {
        streamIds.push(output.symbol);
        seqs.push(output.seq);
        idxs.push(i);
        tss.push(output.ts);
        payloads.push(JSON.stringify(output.events[i]));
      }
    }

    if (streamIds.length === 0) return;

    const sql = `
      WITH lease AS (
        SELECT epoch FROM shard_leases WHERE lease_id = $1 FOR SHARE
      )
      INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json)
      SELECT u.stream_id, u.seq, 'EVENT'::text, u.idx, 1, u.ts, $2, u.payload::jsonb
      FROM unnest($3::text[], $4::integer[], $5::integer[], $6::integer[], $7::text[])
        AS u(stream_id, seq, idx, ts, payload)
      CROSS JOIN (SELECT epoch FROM lease)
      WHERE epoch = $2
      ON CONFLICT DO NOTHING
    `;

    const result = await this.sql.query(sql, [this.leaseId, Number(this.myEpoch), streamIds, seqs, idxs, tss, payloads]);

    if (result.rowCount === 0 && streamIds.length > 0) {
      const leaseResult = await this.sql.query("SELECT epoch FROM shard_leases WHERE lease_id = $1", [this.leaseId]);
      if (leaseResult.rows.length > 0) {
        const currentEpoch = BigInt(String((leaseResult.rows[0] as any).epoch));
        if (currentEpoch !== this.myEpoch) {
          throw new FencedWriterError(`Lease epoch mismatch on appendEvents: my epoch ${this.myEpoch}, current ${currentEpoch}`);
        }
      } else {
        throw new FencedWriterError("Lease not found");
      }
    }
  }

  async upsertOffset(topic: string, partition: number, nextOffset: bigint): Promise<void> {
    // Check lease epoch first
    const leaseResult = await this.sql.query("SELECT epoch FROM shard_leases WHERE lease_id = $1", [this.leaseId]);
    if (leaseResult.rows.length === 0) {
      throw new FencedWriterError("Lease not found");
    }

    const currentEpoch = BigInt(String((leaseResult.rows[0] as any).epoch));
    if (currentEpoch !== this.myEpoch) {
      throw new FencedWriterError(`Lease epoch mismatch on upsertOffset: my epoch ${this.myEpoch}, current ${currentEpoch}`);
    }

    const sql = `
      INSERT INTO consumer_offsets (lease_id, topic, partition, next_offset, writer_epoch)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (lease_id, topic, partition)
      DO UPDATE SET next_offset = GREATEST(consumer_offsets.next_offset, EXCLUDED.next_offset),
                    writer_epoch = EXCLUDED.writer_epoch, updated_at = now()
    `;

    await this.sql.query(sql, [this.leaseId, topic, partition, Number(nextOffset + 1n), Number(this.myEpoch)]);
  }

  async upsertPublishedThrough(symbol: string, seq: bigint): Promise<void> {
    // Check lease epoch first
    const leaseResult = await this.sql.query("SELECT epoch FROM shard_leases WHERE lease_id = $1", [this.leaseId]);
    if (leaseResult.rows.length === 0) {
      throw new FencedWriterError("Lease not found");
    }

    const currentEpoch = BigInt(String((leaseResult.rows[0] as any).epoch));
    if (currentEpoch !== this.myEpoch) {
      throw new FencedWriterError(`Lease epoch mismatch on upsertPublishedThrough: my epoch ${this.myEpoch}, current ${currentEpoch}`);
    }

    const sql = `
      INSERT INTO published_through (lease_id, symbol, seq)
      VALUES ($1, $2, $3)
      ON CONFLICT (lease_id, symbol)
      DO UPDATE SET seq = GREATEST(published_through.seq, EXCLUDED.seq)
    `;

    await this.sql.query(sql, [this.leaseId, symbol, Number(seq)]);
  }
}
