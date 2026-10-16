import type { SqlExecutor } from "@matchledger/journal";
import type { RiskConfig, RiskOutput } from "@matchledger/common";
import { RiskCore } from "../core/risk-core.js";
export interface RecoverRiskPartitionResult {
    partition: number;
    core: RiskCore;
    lastSeq: number;
    lastTs: number;
    replayed: number;
    verified: number;
    regenerated: readonly RiskOutput[];
    snapshotUsed?: {
        lastSeq: number;
    };
    invalidSnapshots: readonly {
        lastSeq: number;
        reason: string;
    }[];
}
export declare function recoverRiskPartition(args: {
    sql: SqlExecutor;
    partition: number;
    config: RiskConfig;
    chunkSize?: number;
}): Promise<RecoverRiskPartitionResult>;
