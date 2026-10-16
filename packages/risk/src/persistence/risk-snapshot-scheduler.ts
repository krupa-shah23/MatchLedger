import type { RiskCore } from "../core/risk-core.js";
import type { RiskSnapshotStore } from "./risk-snapshot-store.js";

export interface SnapshotBatchContext {
  partition: number;
  lastSeq: number;
  lastTs: number;
  core: RiskCore;
}

/** Count-based snapshot scheduler: takes a snapshot every `everyCommands` commands.
 * A snapshot failure is logged and non-fatal; it does not advance lastSnapshotSeq,
 * so the next batch retries. */
export class RiskSnapshotScheduler {
  private lastSnapshotSeq = 0;

  constructor(
    private readonly store: RiskSnapshotStore,
    private readonly everyCommands: number,
    private readonly onError: (err: unknown) => void = () => undefined,
  ) {}

  async afterBatch(ctx: SnapshotBatchContext): Promise<void> {
    if (ctx.lastSeq - this.lastSnapshotSeq < this.everyCommands) return;

    // Export state synchronously (before any awaited I/O) so the snapshot
    // reflects exactly ctx.lastSeq, not a later state if more commands apply
    // concurrently with the save.
    const state = ctx.core.exportState();
    try {
      await this.store.save(ctx.partition, ctx.lastSeq, ctx.lastTs, state);
      this.lastSnapshotSeq = ctx.lastSeq;
    } catch (err) {
      this.onError(err);
      // non-fatal: lastSnapshotSeq unchanged, retried on the next batch
    }
  }
}
