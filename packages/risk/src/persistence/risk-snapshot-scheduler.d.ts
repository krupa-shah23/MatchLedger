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
export declare class RiskSnapshotScheduler {
    private readonly store;
    private readonly everyCommands;
    private readonly onError;
    private lastSnapshotSeq;
    constructor(store: RiskSnapshotStore, everyCommands: number, onError?: (err: unknown) => void);
    afterBatch(ctx: SnapshotBatchContext): Promise<void>;
}
