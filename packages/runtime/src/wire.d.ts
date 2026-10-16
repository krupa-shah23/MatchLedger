import type { SqlExecutor, PgJournal, SnapshotStore } from "@matchledger/journal";
import type { RiskConfig } from "@matchledger/risk";
export interface WireConfig {
    sql: SqlExecutor;
    journal: PgJournal;
    snapshots: SnapshotStore;
    enginePartitions: number;
    riskConfig: RiskConfig;
    instruments: ReadonlyMap<string, any>;
}
export declare function wireRuntime(config: WireConfig): Promise<{
    recovery: import("./recover-pipeline.js").RecoveredPipeline;
    books: Map<number, import("@matchledger/engine-core").OrderBook>;
    riskCores: Map<number, any>;
    engineState: import("@matchledger/journal").RecoveredState;
    ledgerState: any;
    owners: Map<string, string>;
    watermark: number;
}>;
