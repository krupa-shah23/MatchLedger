import type { SqlExecutor } from "@matchledger/journal";
import type { RiskState } from "@matchledger/common";
export interface RiskSnapshotCandidate {
    lastSeq: number;
    lastTs: number;
    version: number;
    state?: RiskState;
    invalid?: "CHECKSUM" | "VERSION" | "DECODE" | "RESTORE";
    invalidReason?: string;
}
export declare class RiskSnapshotStore {
    private readonly sql;
    constructor(sql: SqlExecutor);
    private streamId;
    save(partition: number, lastSeq: number, lastTs: number, state: RiskState): Promise<void>;
    /** Newest-first candidates at or below maxSeq. Each candidate reports why it is
     * invalid (if at all) without throwing, so the caller can fall back to the next
     * older one. */
    listCandidates(partition: number, maxSeq: number): Promise<readonly RiskSnapshotCandidate[]>;
    prune(partition: number, keep: number): Promise<void>;
}
