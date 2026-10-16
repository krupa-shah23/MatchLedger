import type { SqlExecutor, PgJournal, SnapshotStore } from "@matchledger/journal";
import type { RiskConfig } from "@matchledger/risk";
import { recoverPipeline } from "./recover-pipeline.js";

export interface WireConfig {
  sql: SqlExecutor;
  journal: PgJournal;
  snapshots: SnapshotStore;
  enginePartitions: number;
  riskConfig: RiskConfig;
  instruments: ReadonlyMap<string, any>;
}

export async function wireRuntime(config: WireConfig) {
  const recovery = await recoverPipeline(config);

  return {
    recovery,
    books: recovery.books,
    riskCores: recovery.riskCores,
    engineState: recovery.engineState,
    ledgerState: recovery.ledgerState,
    owners: recovery.owners,
    watermark: recovery.watermark,
  };
}
