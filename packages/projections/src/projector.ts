/**
 * Projector: exactly-once projection of journals to read tables.
 * Per stream: BEGIN; lock checkpoint; read chunk after lock; apply mutations; advance; COMMIT; emit notices.
 */

import { NoticeBus } from "./notices.js";
import { fetchCheckpoint, advanceCheckpoint } from "./checkpoints.js";

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
   * Run one projection cycle for a single stream.
   * Atomically: lock checkpoint, read chunk after lock, apply mutations, advance checkpoint, emit notices.
   */
  async runOnce(streamId: string): Promise<number> {
    const projection = "orders"; // TODO: parameterize per stream type
    let appliedCount = 0;

    try {
      await this.deps.executor.transaction(async (executor: any) => {
        // 1. Lock checkpoint (inside transaction)
        const checkpoint = await fetchCheckpoint(executor, projection, streamId);
        const lockedSeq = checkpoint.last_seq;

        // 2. Read chunk AFTER lock, using locked checkpoint value
        const rows = await executor.query(
          `SELECT seq, payload_json, record_type FROM journal
           WHERE symbol = $1 AND seq > $2 AND seq <= $3
           ORDER BY seq, idx`,
          [streamId, lockedSeq, lockedSeq + this.chunkSize]
        );

        appliedCount = rows.rows.length;
        if (appliedCount === 0) return; // No new records

        // 3. Apply mutations (pure mapping not shown; would happen here)
        // TODO: mappers to actual SQL INSERT/UPDATE calls

        // 4. Advance checkpoint
        const newSeq = lockedSeq + appliedCount;
        await advanceCheckpoint(executor, projection, streamId, newSeq);
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
      // Rollback is automatic on transaction error
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

    const locked = (lockResult.rows[0] as any).locked;
    if (!locked) {
      throw new Error("Could not acquire projector singleton lock");
    }

    this.running = true;
    this._poll();
  }

  private _poll(): void {
    if (!this.running) return;

    // TODO: poll all streams
    this.pollTimer = setTimeout(() => this._poll(), 200);
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
    await this.deps.executor.transaction(async (executor) => {
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

      // Replay all journals from seq 1
      // TODO: reapply all mutations from journal
    });
  }

  isRunning(): boolean {
    return this.running;
  }
}
