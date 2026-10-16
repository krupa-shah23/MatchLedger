import type { SqlExecutor } from "@matchledger/journal";
import type { RiskConfig, RiskCore } from "@matchledger/risk";
import { recoverRiskPartition, EngineEventRouter, MarketView } from "@matchledger/risk";
import type { PgJournal, SnapshotStore } from "@matchledger/journal";
import { partitionOf } from "@matchledger/common";
import { recoverStream } from "@matchledger/journal";
import { Ledger, PgLedgerStore } from "@matchledger/ledger";
import { OrderOwnerStore } from "@matchledger/risk";

export interface RecoveryConfig {
  sql: SqlExecutor;
  journal: PgJournal;
  snapshots: SnapshotStore;
  enginePartitions: number;
  riskConfig: RiskConfig;
  instruments: ReadonlyMap<string, any>;
}

export interface PipelineHandle {
  runner: any;
  stage: any;
  router: EngineEventRouter;
  ledger: Ledger;
  stats: { replayed: number; regenerated: number; caughtUp: number; redelivered: number };
  books?: Map<number, any>;
  riskCores?: Map<number, any>;
  engineState?: any;
  ledgerState?: any;
  owners?: Map<string, string>;
  watermark?: number;
}

// Backwards compatibility
export type RecoveredPipeline = PipelineHandle;

async function recoverEnginePartitions(config: RecoveryConfig) {
  const books = new Map<number, any>();
  const seqBySymbol = new Map<string, number>();
  let lastTs = 0;

  for (const [symbol, spec] of config.instruments.entries()) {
    const partition = partitionOf(symbol, config.enginePartitions);
    const result = await recoverStream({ journal: config.journal, snapshots: config.snapshots, symbol, spec });
    books.set(partition, result.book);
    seqBySymbol.set(symbol, result.lastSeq);
    lastTs = Math.max(lastTs, result.lastTs);
  }

  return { books, seqBySymbol, lastTs };
}

export async function recoverPipeline(config: RecoveryConfig): Promise<PipelineHandle> {
  const runner: any = null;
  const stage: any = null;

  try {
    // Step 0: Postgres check
    await config.sql.query("SELECT 1", []);

    // Step 1: Recover engine
    const engineResult = await recoverEnginePartitions(config);
    const books = engineResult.books;
    const engineSeqBySymbol = engineResult.seqBySymbol;

    // Step 2: Recover risk
    const riskCoresByPartition = new Map<number, { core: RiskCore; lastSeq: number; lastTs: number }>();
    for (let i = 0; i < config.enginePartitions; i++) {
      const result = await recoverRiskPartition({ sql: config.sql, partition: i, config: config.riskConfig });
      riskCoresByPartition.set(i, { core: result.core, lastSeq: result.lastSeq, lastTs: result.lastTs });
    }

    // Step 6a: Ledger catch-up (moved earlier, deviation 1)
    const ledgerStore = new PgLedgerStore(config.sql);
    const entries = await ledgerStore.loadAll();
    const ledger = entries.length > 0 ? Ledger.restore(entries) : new Ledger();

    // Step 3: Restore router and MarketView
    const router = new EngineEventRouter({ marketView: new MarketView() });

    for (const symbol of config.instruments.keys()) {
      const partition = partitionOf(symbol, config.enginePartitions);
      const book = books.get(partition);
      if (book) {
        const resting = (book as any).restingOrders?.() ?? [];
        const owners = resting.map((o: any) => ({ orderId: o.orderId, accountId: o.accountId, symbol, side: o.side }));
        router.restoreOwners(owners);

        const marketView = MarketView.fromBook(symbol, book);
        router.setWatermark(symbol, engineSeqBySymbol.get(symbol) ?? 0);
      }
    }

    // Step 3b: reconcileSymbolStatus (TODO)

    // Step 4: Notice catch-up (TODO)

    // Step 5: Redelivery (TODO)

    // Step 6b: Final verification
    for (const state of riskCoresByPartition.values()) {
      const issues = state.core.checkInvariants();
      if (issues.length > 0) throw new Error(`Risk invariant violations: ${issues.join(", ")}`);
    }

    // Return handle
    return {
      runner,
      stage,
      router,
      ledger,
      stats: { replayed: 0, regenerated: 0, caughtUp: 0, redelivered: 0 },
    };
  } catch (err) {
    if (runner) await (runner.stop?.({ drain: false }) ?? Promise.resolve());
    if (stage) await stage.stop?.();
    throw err;
  }
}
