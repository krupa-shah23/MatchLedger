import type { SqlExecutor } from "@matchledger/journal";
import type { OrderBook } from "@matchledger/engine-core";
import type { RiskConfig } from "@matchledger/risk";
import { recoverRiskPartition } from "@matchledger/risk";
import type { PgJournal, SnapshotStore, RecoveredState } from "@matchledger/journal";
import { partitionOf } from "@matchledger/common";

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

export async function recoverPipeline(config: RecoveryConfig): Promise<RecoveredPipeline> {
  const books = new Map<number, OrderBook>();
  const riskCores = new Map<number, any>();
  let engineState: RecoveredState | null = null;
  let ledgerState: any = null;
  const owners = new Map<string, string>();
  let marketView: any = null;
  let watermark = 0;

  // Step 1: Recover engine partitions
  console.log("[Recovery] Step 1: Engine recovery...");
  try {
    const result = await recoverEnginePartitions(config);
    engineState = result.state;
    for (const [partition, book] of result.books) {
      books.set(partition, book);
    }
  } catch (err) {
    console.error("[Recovery] FATAL: Engine recovery failed");
    throw err;
  }

  // Step 2: Recover risk partitions
  console.log("[Recovery] Step 2: Risk recovery...");
  for (let i = 0; i < config.enginePartitions; i++) {
    try {
      const result = await recoverRiskPartition({ sql: config.sql, partition: i, config: config.riskConfig });
      riskCores.set(i, result.core);
    } catch (err) {
      console.error(`[Recovery] FATAL: Risk partition ${i} recovery failed`);
      throw err;
    }
  }

  // Step 3: Restore owners, MarketView, watermark
  // NOT YET IMPLEMENTED per docs/WEEK-8.md 4.5 step 3: this requires
  // EngineEventRouter.restoreOwners()/setWatermark() and MarketView.fromBook(),
  // none of which exist yet. The block below is a partial approximation (reads
  // taker ownership directly off the recovered book) and is NOT the spec's owner
  // rebuild via PgOrderOwners.getMany(); it is kept only so watermark has a value.
  console.log("[Recovery] Step 3: Owners/MarketView/watermark restoration (partial, see comment)...");
  if (engineState) {
    for (const symbol of config.instruments.keys()) {
      const partition = partitionOf(symbol, config.enginePartitions);
      const book = books.get(partition);
      if (book) {
        for (const order of (book as any).orders?.values?.() ?? []) {
          if (order.takerAccountId) {
            owners.set(order.id, order.takerAccountId);
          }
        }
      }
    }
    watermark = engineState.lastTs ?? 0;
  }

  // Step 4: Notice catch-up -- NOT IMPLEMENTED. Requires
  // engineJournal.readEventsForOrder() + router catch-up mode (docs/WEEK-8.md 4.5 step 4).
  console.log("[Recovery] Step 4: Notice catch-up -- NOT IMPLEMENTED");

  // Step 5: Redelivery -- NOT IMPLEMENTED. Requires PgRiskJournal.hasSubmit() +
  // engineJournal.hasCommandForOrder() + findOrderAccepted() + shard re-enqueue
  // (docs/WEEK-8.md 4.5 step 5). PgRiskJournal.hasSubmit() exists; the redelivery
  // loop over PENDING_ACK reservations and shard re-enqueue do not.
  console.log("[Recovery] Step 5: Redelivery -- NOT IMPLEMENTED");

  // Step 6: Ledger catch-up -- NOT IMPLEMENTED. Requires Ledger.restore(loadAll())
  // + catchUpLedger() wired to the recovered risk cores and engine journal.
  console.log("[Recovery] Step 6: Ledger catch-up -- NOT IMPLEMENTED");
  ledgerState = { verified: false, note: "ledger catch-up not implemented" };

  // Step 7: Start services -- NOT IMPLEMENTED. recoverPipeline currently returns
  // recovered state; it does not start a ShardRunner/RiskStage/TickInjector/sweeper.
  console.log("[Recovery] Step 7: Start services -- NOT IMPLEMENTED");

  return {
    books,
    riskCores,
    engineState: engineState!,
    ledgerState,
    owners,
    marketView,
    watermark,
  };
}

async function recoverEnginePartitions(config: RecoveryConfig): Promise<{
  state: RecoveredState;
  books: Map<number, OrderBook>;
}> {
  const { recoverShard } = await import("@matchledger/journal");
  const result = await recoverShard({
    journal: config.journal,
    snapshots: config.snapshots,
    symbols: config.instruments,
  });

  const books = new Map<number, OrderBook>();
  const seenPartitions = new Set<number>();
  for (const [symbol] of result.recovered.streams) {
    const partition = partitionOf(symbol, config.enginePartitions);
    if (!seenPartitions.has(partition)) {
      const stream = result.recovered.streams.get(symbol);
      if (stream) {
        books.set(partition, stream.book as unknown as OrderBook);
        seenPartitions.add(partition);
      }
    }
  }

  return { state: result.recovered, books };
}
