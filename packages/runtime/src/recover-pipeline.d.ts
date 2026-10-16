import type { SqlExecutor } from "@matchledger/journal";
import type { OrderBook } from "@matchledger/engine-core";
import type { RiskConfig } from "@matchledger/risk";
import type { PgJournal, SnapshotStore, RecoveredState } from "@matchledger/journal";
export interface RecoveryConfig {
    sql: SqlExecutor;
    journal: PgJournal;
    snapshots: SnapshotStore;
    enginePartitions: number;
    riskConfig: RiskConfig;
    instruments: ReadonlyMap<string, any>;
}
export interface RecoveredPipeline {
    books: Map<number, OrderBook>;
    riskCores: Map<number, any>;
    engineState: RecoveredState;
    ledgerState: any;
    owners: Map<string, string>;
    marketView: any;
    watermark: number;
}
export declare function recoverPipeline(config: RecoveryConfig): Promise<RecoveredPipeline>;
