/**
 * Recover control plane (Kafka mode, Week 10).
 * Steps 2-6 of recoverPipeline with step 1 replaced by read-only engine journal access.
 * MarketView rebuilds by replaying engine EVENT rows through MarketView.apply.
 */

import type { SqlExecutor, PgJournal, SnapshotStore } from "@matchledger/journal";
import type { RiskConfig } from "@matchledger/risk";
import { recoverRiskPartition, EngineEventRouter, MarketView } from "@matchledger/risk";
import { Ledger, PgLedgerStore } from "@matchledger/ledger";
import { partitionOf } from "@matchledger/common";

export interface RecoverControlPlaneConfig {
  sql: SqlExecutor;
  journal: PgJournal; // Read-only access to engine journal
  snapshots: SnapshotStore;
  enginePartitions: number;
  riskConfig: RiskConfig;
  instruments: ReadonlyMap<string, any>;
}

export interface ControlPlaneHandle {
  router: EngineEventRouter;
  ledger: Ledger;
  watermarks: Map<string, number>; // Symbol -> last processed seq
  stats: { recovered: number };
}

/**
 * Recover control plane from engine journal (read-only), risk partitions, and ledger.
 * Step 1 (engine shard recovery) is skipped; engine state is only read.
 * MarketView is rebuilt by replaying engine EVENT rows.
 */
export async function recoverControlPlane(config: RecoverControlPlaneConfig): Promise<ControlPlaneHandle> {
  try {
    // Step 0: Postgres check
    await config.sql.query("SELECT 1", []);

    // Step 1: Skip shard recovery; engine journal is read-only
    // MarketView will be populated from replayed events below

    // Step 2: Recover risk
    const riskCoresByPartition = new Map<number, { core: any; lastSeq: number; lastTs: number }>();
    for (let i = 0; i < config.enginePartitions; i++) {
      const result = await recoverRiskPartition({ sql: config.sql, partition: i, config: config.riskConfig });
      riskCoresByPartition.set(i, { core: result.core, lastSeq: result.lastSeq, lastTs: result.lastTs });
    }

    // Step 3: Restore router and MarketView (empty initially)
    const router = new EngineEventRouter({ marketView: new MarketView() });
    const watermarks = new Map<string, number>();

    // Step 3b: Replay engine EVENT rows to rebuild MarketView
    // This is done by reading events from the journal and applying them
    let recoveredEvents = 0;
    for (const symbol of config.instruments.keys()) {
      // Read all EVENT rows for this symbol from the read-only journal
      const events = await config.journal.readEvents(symbol, 0, Number.MAX_SAFE_INTEGER);

      for (const event of events) {
        const eventData = event as any;
        const eventPayload = eventData.payload;
        if (eventPayload && eventPayload.type === "Trade") {
          // Apply trade events to MarketView
          router.marketView?.apply(symbol, eventPayload, eventData.ts);
          recoveredEvents++;
        }
      }

      // Set watermark to last processed event seq
      const lastSeq = events.length > 0 ? (events[events.length - 1] as any).seq : 0;
      watermarks.set(symbol, lastSeq);
      router.setWatermark(symbol, lastSeq);
    }

    // Step 6a: Ledger catch-up
    const ledgerStore = new PgLedgerStore(config.sql);
    const entries = await ledgerStore.loadAll();
    const ledger = entries.length > 0 ? Ledger.restore(entries) : new Ledger();

    // Step 6b: Final verification (placeholder)

    return {
      router,
      ledger,
      watermarks,
      stats: { recovered: recoveredEvents },
    };
  } catch (error) {
    console.error("[recover-control-plane] Recovery failed:", error);
    throw error;
  }
}
