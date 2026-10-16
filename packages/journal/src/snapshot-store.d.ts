import type { Pool } from "pg";
import type { SnapshotStore, SnapshotRecord, SnapshotCandidate } from "@matchledger/common";
export declare class PgSnapshotStore implements SnapshotStore {
    private readonly pool;
    constructor(pool: Pool);
    save(record: SnapshotRecord): Promise<void>;
    listCandidates(stream: string, opts: {
        maxSeq: number;
    }): Promise<readonly SnapshotCandidate[]>;
    prune(stream: string, keep: number): Promise<void>;
}
