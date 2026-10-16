/** Count-based snapshot scheduler: takes a snapshot every `everyCommands` commands.
 * A snapshot failure is logged and non-fatal; it does not advance lastSnapshotSeq,
 * so the next batch retries. */
export class RiskSnapshotScheduler {
    store;
    everyCommands;
    onError;
    lastSnapshotSeq = 0;
    constructor(store, everyCommands, onError = () => undefined) {
        this.store = store;
        this.everyCommands = everyCommands;
        this.onError = onError;
    }
    async afterBatch(ctx) {
        if (ctx.lastSeq - this.lastSnapshotSeq < this.everyCommands)
            return;
        // Export state synchronously (before any awaited I/O) so the snapshot
        // reflects exactly ctx.lastSeq, not a later state if more commands apply
        // concurrently with the save.
        const state = ctx.core.exportState();
        try {
            await this.store.save(ctx.partition, ctx.lastSeq, ctx.lastTs, state);
            this.lastSnapshotSeq = ctx.lastSeq;
        }
        catch (err) {
            this.onError(err);
            // non-fatal: lastSnapshotSeq unchanged, retried on the next batch
        }
    }
}
