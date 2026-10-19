/**
 * Projector: exactly-once projection of journals to read tables.
 * Per stream: BEGIN; lock checkpoint; read chunk after lock; apply mutations; advance; COMMIT; emit notices.
 */

import { NoticeBus } from "./notices.js";
import { fetchCheckpoint, advanceCheckpoint } from "./checkpoints.js";
import { mapRiskRecord, mapEngineRecord, type Mutation } from "./mappers.js";

export interface ProjectorDeps {
  executor: {
    query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
    transaction<T>(fn: (executor: ProjectorDeps["executor"]) => Promise<T>): Promise<T>;
  };
  noticeBus: NoticeBus;
  chunkSize?: number;
}

export class Projector {
  private deps: ProjectorDeps;
  private running = false;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private chunkSize: number;

  constructor(deps: ProjectorDeps) {
    this.deps = deps;
    this.chunkSize = deps.chunkSize ?? 1000;
  }

  /**
   * Apply mutations to the database.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async applyMutations(executor: any, mutations: Mutation[]): Promise<void> {
    for (const m of mutations) {
      switch (m.type) {
        case "INSERT_ORDER":
          await executor.query(
            `INSERT INTO orders_view (order_id, account_id, client_order_id, symbol, side, order_type, time_in_force,
              quantity, price, effective_price, received_ts, accepted, rested, filled_qty, filled_notional, terminal, terminal_reason, cancel_requested)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             ON CONFLICT (order_id) DO NOTHING`,
            [
              m.orderId,
              m.data.account_id,
              m.data.client_order_id,
              m.data.symbol,
              m.data.side,
              m.data.order_type,
              m.data.time_in_force,
              m.data.quantity,
              m.data.price,
              m.data.effective_price,
              m.data.received_ts,
              m.data.accepted,
              m.data.rested,
              m.data.filled_qty,
              m.data.filled_notional,
              m.data.terminal,
              m.data.terminal_reason,
              m.data.cancel_requested,
            ]
          );
          break;

        case "UPDATE_ORDER":
          const updates = Object.entries(m.data)
            .map(([k], i) => `${k} = $${i + 2}`)
            .join(", ");
          const updateValues = Object.values(m.data);
          await executor.query(
            `UPDATE orders_view SET ${updates} WHERE order_id = $1`,
            [m.orderId, ...updateValues]
          );
          break;

        case "INSERT_FILL":
          await executor.query(
            `INSERT INTO order_fills (order_id, trade_id, price, quantity, role, ts)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (order_id, trade_id) DO NOTHING`,
            [m.orderId, m.tradeId, m.data.price, m.data.quantity, m.data.role, m.data.ts]
          );
          break;

        case "INSERT_RESTING":
          await executor.query(
            `INSERT INTO resting_orders (symbol, order_id, side, price, remaining)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (symbol, order_id) DO UPDATE SET remaining = $5`,
            [m.symbol, m.orderId, m.data.side, m.data.price, m.data.remaining]
          );
          break;

        case "UPDATE_RESTING_REMAINING":
          if (m.remaining > 0n) {
            await executor.query(
              `UPDATE resting_orders SET remaining = $1 WHERE symbol = $2 AND order_id = $3`,
              [m.remaining, m.symbol, m.orderId]
            );
          } else {
            await executor.query(
              `DELETE FROM resting_orders WHERE symbol = $1 AND order_id = $2`,
              [m.symbol, m.orderId]
            );
          }
          break;

        case "DELETE_RESTING":
          await executor.query(
            `DELETE FROM resting_orders WHERE symbol = $1 AND order_id = $2`,
            [m.symbol, m.orderId]
          );
          break;

        case "INSERT_TRADE":
          await executor.query(
            `INSERT INTO trades_view (symbol, engine_seq, idx, trade_id, price, quantity, taker_side, ts)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (symbol, engine_seq, idx) DO NOTHING`,
            [m.symbol, m.engineSeq, m.idx ?? 0, m.data.trade_id, m.data.price, m.data.quantity, m.data.taker_side, m.data.ts]
          );
          break;

        case "UPDATE_BALANCES": {
          const updates = Object.entries(m.data)
            .map(([k], i) => `${k} = ${k} + $${i + 2}`)
            .join(", ");
          const updateValues = Object.values(m.data);
          await executor.query(
            `INSERT INTO balances_view (account_id) VALUES ($1) ON CONFLICT (account_id) DO NOTHING`,
            [m.accountId]
          );
          await executor.query(
            `UPDATE balances_view SET ${updates} WHERE account_id = $1`,
            [m.accountId, ...updateValues]
          );
          break;
        }

        case "UPDATE_POSITION": {
          const updates = Object.entries(m.data)
            .map(([k], i) => `${k} = ${k} + $${i + 3}`)
            .join(", ");
          const updateValues = Object.values(m.data);
          await executor.query(
            `INSERT INTO positions_view (account_id, symbol) VALUES ($1, $2) ON CONFLICT (account_id, symbol) DO NOTHING`,
            [m.accountId, m.symbol]
          );
          await executor.query(
            `UPDATE positions_view SET ${updates} WHERE account_id = $1 AND symbol = $2`,
            [m.accountId, m.symbol, ...updateValues]
          );
          break;
        }

        case "INSERT_RESERVATION":
          await executor.query(
            `INSERT INTO reservations_view (order_id, account_id, symbol, side, asset, amount_total, amount_remaining, status, released_reason, converted_amount, improvement_released)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (order_id) DO NOTHING`,
            [
              m.orderId,
              m.data.account_id,
              m.data.symbol,
              m.data.side,
              m.data.asset,
              m.data.amount_total,
              m.data.amount_remaining,
              m.data.status,
              m.data.released_reason,
              m.data.converted_amount,
              m.data.improvement_released,
            ]
          );
          break;

        case "UPDATE_RESERVATION":
          const resUpdates = Object.entries(m.data)
            .map(([k], i) => `${k} = $${i + 2}`)
            .join(", ");
          const resValues = Object.values(m.data);
          await executor.query(
            `UPDATE reservations_view SET ${resUpdates} WHERE order_id = $1`,
            [m.orderId, ...resValues]
          );
          break;

        case "INSERT_REJECTION":
          await executor.query(
            `INSERT INTO rejections_view (source, order_id, account_id, symbol, reason, required, snapshot_json, ts)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (source, order_id) DO NOTHING`,
            [
              m.data.source,
              m.data.order_id,
              m.data.account_id,
              m.data.symbol,
              m.data.reason,
              m.data.required,
              m.data.snapshot_json,
              m.data.ts,
            ]
          );
          break;

        case "UPDATE_BREAKER":
          const breakerUpdates = Object.entries(m.data)
            .map(([k], i) => `${k} = $${i + 2}`)
            .join(", ");
          const breakerValues = Object.values(m.data);
          await executor.query(
            `INSERT INTO breaker_view (symbol) VALUES ($1) ON CONFLICT (symbol) DO NOTHING`,
            [m.symbol]
          );
          await executor.query(
            `UPDATE breaker_view SET ${breakerUpdates} WHERE symbol = $1`,
            [m.symbol, ...breakerValues]
          );
          break;
      }
    }
  }

  /**
   * Run one projection cycle for a single stream.
   * Atomically: lock checkpoint, read chunk after lock, apply mutations, advance checkpoint, emit notices.
   */
  async runOnce(streamId: string): Promise<number> {
    const projection = "orders";
    let appliedCount = 0;
    let maxSeq = 0;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.deps.executor.transaction(async (executor: any) => {
        // 1. Lock checkpoint (inside transaction)
        const checkpoint = await fetchCheckpoint(executor, projection, streamId);
        const lockedSeq = checkpoint.last_seq;

        // 2. Read chunk AFTER lock, using locked checkpoint value
        const rows = await executor.query(
          `SELECT seq, idx, payload_json, record_type, symbol FROM journal
           WHERE symbol = $1 AND seq > $2 AND seq <= $3
           ORDER BY seq, idx`,
          [streamId, lockedSeq, lockedSeq + this.chunkSize]
        );

        appliedCount = rows.rows.length;
        if (appliedCount === 0) return;

        // 3. Apply mutations from each journal record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of (rows.rows as any[])) {
          maxSeq = Math.max(maxSeq, row.seq);
          const mutations =
            row.record_type === "COMMAND" || row.record_type === "EVENT"
              ? row.symbol
                ? mapEngineRecord({
                    record_type: row.record_type,
                    payload_json: row.payload_json,
                    symbol: row.symbol,
                    seq: row.seq,
                    idx: row.idx,
                  })
                : mapRiskRecord({
                    record_type: row.record_type,
                    payload_json: row.payload_json,
                    seq: row.seq,
                  })
              : [];

          await this.applyMutations(executor, mutations);
        }

        // 4. Advance checkpoint to the last seq processed
        await advanceCheckpoint(executor, projection, streamId, maxSeq);
      });

      // 5. Emit notices ONLY after commit succeeds
      if (appliedCount > 0) {
        this.deps.noticeBus.publish({
          type: "ORDER_CHANGED",
          orderId: `batch-${streamId}`,
          status: "updated",
        });
      }
    } catch (err) {
      throw err;
    }

    return appliedCount;
  }

  /**
   * Start the projector poller with advisory singleton lock.
   */
  async start(): Promise<void> {
    if (this.running) throw new Error("Projector already running");

    // Try to acquire advisory lock (singleton)
    const lockResult = await this.deps.executor.query(
      "SELECT pg_try_advisory_lock(1) AS locked;",
      []
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locked = ((lockResult.rows[0] as any) as { locked: boolean }).locked;
    if (!locked) {
      throw new Error("Could not acquire projector singleton lock");
    }

    this.running = true;
    this._poll();
  }

  private _poll(): void {
    if (!this.running) return;

    // Poll all streams: risk partition + all engine symbols
    const streamIds = ["risk", "AAPL", "GOOGL", "MSFT", "TSLA", "AMZN"];

    (async () => {
      for (const streamId of streamIds) {
        try {
          await this.runOnce(streamId);
        } catch (err) {
          // Log but continue with other streams
          console.error(`Error projecting ${streamId}:`, err);
        }
      }

      // Reschedule poll
      if (this.running) {
        this.pollTimer = setTimeout(() => this._poll(), this.chunkSize ? 200 : 200);
      }
    })();
  }

  /**
   * Stop the projector and release singleton lock.
   */
  async stop(): Promise<void> {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.running = false;

    // Release advisory lock
    await this.deps.executor.query("SELECT pg_advisory_unlock(1);", []);
  }

  /**
   * Wake the projector (signal to poll immediately, not yet implemented).
   */
  wake(): void {
    // TODO: force next poll iteration
  }

  /**
   * Rebuild: truncate all tables and replay all journals from seq 1 in one transaction.
   */
  async rebuild(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.deps.executor.transaction(async (executor: any) => {
      // Truncate all projection tables
      const tables = [
        "orders_view",
        "order_fills",
        "resting_orders",
        "trades_view",
        "balances_view",
        "positions_view",
        "reservations_view",
        "rejections_view",
        "breaker_view",
        "projection_checkpoints",
      ];

      for (const table of tables) {
        await executor.query(`TRUNCATE TABLE ${table} CASCADE;`, []);
      }

      // Replay all journals from seq 1, grouped by stream
      const journalRows = await executor.query(
        `SELECT seq, idx, payload_json, record_type, symbol FROM journal
         ORDER BY symbol, seq, idx`,
        []
      );

      const streamCheckpoints: Map<string, number> = new Map();

      // Apply mutations for each record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (journalRows.rows as any[])) {
        const streamId = row.symbol || "risk"; // Default to "risk" for risk partition records
        const mutations =
          row.record_type === "COMMAND" || row.record_type === "EVENT"
            ? row.symbol
              ? mapEngineRecord({
                  record_type: row.record_type,
                  payload_json: row.payload_json,
                  symbol: row.symbol,
                  seq: row.seq,
                  idx: row.idx,
                })
              : mapRiskRecord({
                  record_type: row.record_type,
                  payload_json: row.payload_json,
                  seq: row.seq,
                })
            : [];

        await this.applyMutations(executor, mutations);
        streamCheckpoints.set(streamId, row.seq);
      }

      // Set final checkpoints for each stream
      for (const [streamId, seq] of streamCheckpoints) {
        await executor.query(
          `INSERT INTO projection_checkpoints (projection, stream_id, last_seq)
           VALUES ($1, $2, $3)
           ON CONFLICT (projection, stream_id) DO UPDATE SET last_seq = $3, updated_at = now()`,
          ["orders", streamId, seq]
        );
      }
    });
  }

  isRunning(): boolean {
    return this.running;
  }
}
