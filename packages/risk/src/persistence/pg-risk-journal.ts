import type { SqlExecutor } from "@matchledger/journal";
import { JournalConflictError, JournalSequenceError, toSafeNumber } from "@matchledger/journal";
import type { RiskEvent, RiskOutput, StampedRiskCommand } from "@matchledger/common";
import { deserializeRiskCommand, deserializeRiskEvent, serializeRiskCommand, serializeRiskEvent } from "@matchledger/common";
import { OrderOwnerConflictError } from "./errors.js";

function orderAcceptedEvent(evt: RiskEvent): Extract<RiskEvent, { type: "OrderAccepted" }> | undefined {
  return evt.type === "OrderAccepted" ? evt : undefined;
}

export class PgRiskJournal {
  private constructor(
    private readonly sql: SqlExecutor,
    private readonly partition: number,
    private readonly writerEpoch: bigint,
  ) {}

  static async create(
    sql: SqlExecutor,
    opts: { partition: number; writerEpoch: bigint },
  ): Promise<PgRiskJournal> {
    return new PgRiskJournal(sql, opts.partition, opts.writerEpoch);
  }

  private streamId(): string {
    return `risk-${this.partition}`;
  }

  async lastCommandSeq(): Promise<number> {
    const res = await this.sql.query(
      `SELECT MAX(seq) as max_seq FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND'`,
      [this.streamId()],
    );
    const max = (res.rows[0] as { max_seq: string | number | null } | undefined)?.max_seq;
    return max === null || max === undefined ? 0 : toSafeNumber(max);
  }

  async lastSeq(): Promise<number> {
    const res = await this.sql.query(`SELECT MAX(seq) as max_seq FROM journal WHERE stream_id = $1`, [this.streamId()]);
    const max = (res.rows[0] as { max_seq: string | number | null } | undefined)?.max_seq;
    return max === null || max === undefined ? 0 : toSafeNumber(max);
  }

  /** Appends a batch of stamped commands as ONE statement, validating per-partition
   * contiguity for new commands. Idempotent: duplicate seqs are silently ignored (ON CONFLICT DO NOTHING). */
  async append(batch: readonly StampedRiskCommand[]): Promise<void> {
    if (batch.length === 0) return;

    const streamId = this.streamId();
    const baseline = await this.lastCommandSeq();
    let expected = baseline;

    // Find the first new command (seq > baseline)
    let firstNewIdx = batch.length;
    for (let i = 0; i < batch.length; i++) {
      if (batch[i]!.seq > baseline) {
        firstNewIdx = i;
        break;
      }
    }

    // Validate contiguity only for new commands
    for (let i = firstNewIdx; i < batch.length; i++) {
      const cmd = batch[i]!;
      expected += 1;
      if (cmd.seq !== expected) {
        throw new JournalSequenceError(`dup/gap seq in risk command batch for ${streamId}: expected ${expected}, got ${cmd.seq}`);
      }
    }

    const values: unknown[] = [];
    const rows: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      const cmd = batch[i]!;
      values.push(streamId, cmd.seq, "COMMAND", 0, 1, cmd.ts, this.writerEpoch.toString(), serializeRiskCommand(cmd.command));
      rows.push(
        `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`,
      );
    }
    const query = `INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json) VALUES ${rows.join(",")} ON CONFLICT DO NOTHING`;

    try {
      await this.sql.query(query, values);
    } catch (error) {
      throw new JournalConflictError(String(error));
    }
  }

  /** Appends a batch of risk outputs (events) in one transaction. For every
   * OrderAccepted event, also inserts/verifies the order_owners row atomically
   * with the event rows: if the owner conflicts, the whole transaction rolls back
   * (including the event rows), so nothing becomes durable half-way. */
  async appendEvents(outputs: readonly RiskOutput[]): Promise<void> {
    if (outputs.length === 0) return;
    const streamId = this.streamId();

    await this.sql.transaction(async (tx) => {
      const values: unknown[] = [];
      const rows: string[] = [];
      let idx = 0;
      // `${seq}:${idx}` -> intended event, compared structurally (not as raw JSON
      // text) because Postgres jsonb does not preserve key order/formatting.
      const intended = new Map<string, RiskEvent>();

      for (const output of outputs) {
        for (let i = 0; i < output.events.length; i++) {
          const evt = output.events[i]!;
          const payload = serializeRiskEvent(evt);
          intended.set(`${output.seq}:${i}`, evt);
          values.push(streamId, output.seq, "EVENT", i, 1, output.ts, this.writerEpoch.toString(), payload);
          rows.push(
            `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`,
          );
          idx++;
        }
      }

      if (rows.length > 0) {
        const insertSql = `INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json) VALUES ${rows.join(",")} ON CONFLICT DO NOTHING`;
        await tx.query(insertSql, values);

        // Compare stored vs intended for every key in this batch; a mismatch means
        // a prior write with different content occupies that slot. Both sides are
        // decoded back into RiskEvent and re-canonicalized before comparing, since
        // jsonb storage does not round-trip raw JSON text byte-for-byte.
        const seqs = [...new Set(outputs.map((o) => o.seq))];
        const stored = await tx.query(
          `SELECT seq, idx, payload_json::text as payload_text FROM journal WHERE stream_id = $1 AND record_type = 'EVENT' AND seq = ANY($2)`,
          [streamId, seqs],
        );
        for (const row of stored.rows as { seq: string | number; idx: number; payload_text: string }[]) {
          const key = `${toSafeNumber(row.seq)}:${row.idx}`;
          const intendedEvt = intended.get(key);
          if (intendedEvt === undefined) continue;
          const storedEvt = deserializeRiskEvent(row.payload_text);
          if (serializeRiskEvent(storedEvt) !== serializeRiskEvent(intendedEvt)) {
            throw new JournalConflictError(`risk event conflict at ${streamId} seq=${row.seq} idx=${row.idx}`);
          }
        }
      }

      // Atomically insert/verify order_owners for every OrderAccepted event.
      for (const output of outputs) {
        for (const evt of output.events) {
          const accepted = orderAcceptedEvent(evt);
          if (accepted === undefined) continue;

          await tx.query(
            `INSERT INTO order_owners (order_id, account_id, symbol, side) VALUES ($1, $2, $3, $4) ON CONFLICT (order_id) DO NOTHING`,
            [accepted.orderId, accepted.accountId, accepted.symbol, accepted.side],
          );
          const ownerRes = await tx.query(`SELECT account_id, symbol, side FROM order_owners WHERE order_id = $1`, [accepted.orderId]);
          const owner = ownerRes.rows[0] as { account_id: string; symbol: string; side: string } | undefined;
          if (
            owner === undefined ||
            owner.account_id !== accepted.accountId ||
            owner.symbol !== accepted.symbol ||
            owner.side !== accepted.side
          ) {
            throw new OrderOwnerConflictError(accepted.orderId, `order_owners conflict for ${accepted.orderId}`);
          }
        }
      }
    });
  }

  async readCommands(fromSeq: number, chunkSize = 1000): Promise<readonly StampedRiskCommand[]> {
    const res = await this.sql.query(
      `SELECT seq, ts, payload_json FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND' AND seq > $2 ORDER BY seq LIMIT $3`,
      [this.streamId(), fromSeq, chunkSize],
    );
    return res.rows.map((row) => {
      const r = row as { seq: string | number; ts: string | number; payload_json: unknown };
      const payload = typeof r.payload_json === "string" ? r.payload_json : JSON.stringify(r.payload_json);
      return {
        partition: this.partition,
        seq: toSafeNumber(r.seq),
        ts: toSafeNumber(r.ts),
        command: deserializeRiskCommand(payload),
      };
    });
  }

  async readEvents(fromSeq: number, toSeq: number): Promise<ReadonlyMap<number, readonly RiskEvent[]>> {
    const res = await this.sql.query(
      `SELECT seq, payload_json FROM journal WHERE stream_id = $1 AND record_type = 'EVENT' AND seq >= $2 AND seq <= $3 ORDER BY seq, idx`,
      [this.streamId(), fromSeq, toSeq],
    );
    const out = new Map<number, RiskEvent[]>();
    for (const row of res.rows) {
      const r = row as { seq: string | number; payload_json: unknown };
      const seq = toSafeNumber(r.seq);
      const payload = typeof r.payload_json === "string" ? r.payload_json : JSON.stringify(r.payload_json);
      const list = out.get(seq) ?? [];
      list.push(deserializeRiskEvent(payload));
      out.set(seq, list);
    }
    return out;
  }

  async hasCommandForOrder(orderId: string): Promise<boolean> {
    const res = await this.sql.query(
      `SELECT 1 FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND' AND (payload_json->>'orderId' = $2) LIMIT 1`,
      [this.streamId(), orderId],
    );
    return res.rows.length > 0;
  }

  async findOrderAccepted(orderId: string): Promise<Extract<RiskEvent, { type: "OrderAccepted" }> | undefined> {
    const res = await this.sql.query(
      `SELECT payload_json FROM journal WHERE stream_id = $1 AND record_type = 'EVENT' AND (payload_json->>'orderId' = $2) AND (payload_json->>'type' = 'OrderAccepted') ORDER BY seq LIMIT 1`,
      [this.streamId(), orderId],
    );
    const row = res.rows[0] as { payload_json: unknown } | undefined;
    if (row === undefined) return undefined;
    const payload = typeof row.payload_json === "string" ? row.payload_json : JSON.stringify(row.payload_json);
    const evt = deserializeRiskEvent(payload);
    return evt.type === "OrderAccepted" ? evt : undefined;
  }

  async hasSubmit(orderId: string): Promise<boolean> {
    const res = await this.sql.query(
      `SELECT 1 FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND' AND (payload_json->>'orderId' = $2) AND (payload_json->>'type' = 'SubmitOrder') LIMIT 1`,
      [this.streamId(), orderId],
    );
    return res.rows.length > 0;
  }
}
