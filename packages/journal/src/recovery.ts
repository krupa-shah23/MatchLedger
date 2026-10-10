import type { InstrumentSpec, OrderBook } from "@matchledger/engine-core";
import type { ShardOutput } from "@matchledger/common";

export type SnapshotCandidate = {
  readonly lastSeq: number;
  readonly lastTs: number;
  readonly symbol: string;
  readonly version?: number;
  readonly data?: unknown;
};

export type SnapshotStore = {
  readonly listCandidates: (symbol: string, options: { readonly maxSeq: number }) => readonly SnapshotCandidate[];
};

export type PgJournal = {
  readonly append: (batch: readonly unknown[]) => Promise<void>;
  readonly appendEvents: (batch: readonly ShardOutput[]) => Promise<void>;
  readonly readCommands: (symbol: string, fromSeq: number, chunkSize: number) => Promise<readonly { readonly seq: number; readonly ts: number; readonly command: unknown }[]>;
  readonly readEvents: (symbol: string, fromSeq: number, toSeq: number) => Promise<readonly { readonly seq: number; readonly ts: number; readonly payload: unknown }[]>;
  readonly lastCommandSeq: (symbol: string) => Promise<number>;
};

export class JournalGapError extends Error {
  public constructor(public readonly symbol: string, public readonly expected: number, public readonly got: number) {
    super(`JournalGapError: ${symbol} expected seq ${expected} but found ${got}`);
    this.name = "JournalGapError";
  }
}

export class ReplayMismatchError extends Error {
  public constructor(
    public readonly symbol: string,
    public readonly seq: number,
    public readonly expected: unknown,
    public readonly actual: unknown,
    public readonly diff: string,
  ) {
    super(`ReplayMismatchError: ${symbol} seq ${seq} mismatch: ${diff}`);
    this.name = "ReplayMismatchError";
  }
}

export type RecoveryResult = {
  readonly symbol: string;
  readonly book: OrderBook;
  readonly lastSeq: number;
  readonly lastTs: number;
  readonly replayed: number;
  readonly verified: number;
  readonly regenerated: readonly ShardOutput[];
  readonly snapshotUsed?: { readonly lastSeq: number };
  readonly invalidSnapshots: readonly { readonly lastSeq: number; readonly reason: string }[];
};

export type RecoveredStreamState = {
  readonly book: OrderBook;
  readonly lastSeq: number;
  readonly lastTs: number;
};

export type RecoveredState = {
  readonly streams: ReadonlyMap<string, RecoveredStreamState>;
  readonly lastSeqBySymbol: ReadonlyMap<string, number>;
  readonly lastTs: number;
};

export async function recoverStream(args: {
  readonly journal: PgJournal;
  readonly snapshots: SnapshotStore;
  readonly symbol: string;
  readonly spec: InstrumentSpec;
  readonly chunkSize?: number;
}): Promise<RecoveryResult> {
  void args;
  throw new Error("recoverStream: hand-written (docs/WEEK-5.md 4.5)");
}

export async function recoverShard(args: {
  readonly journal: PgJournal;
  readonly snapshots: SnapshotStore;
  readonly symbols: ReadonlyMap<string, InstrumentSpec>;
  readonly chunkSize?: number;
}): Promise<{ readonly recovered: RecoveredState; readonly regenerated: readonly ShardOutput[]; readonly results: readonly RecoveryResult[] }> {
  const results: RecoveryResult[] = [];
  const regenerated: ShardOutput[] = [];
  const streams = new Map<string, RecoveredStreamState>();
  const lastSeqBySymbol = new Map<string, number>();
  let lastTs = Number.NEGATIVE_INFINITY;

  for (const [symbol, spec] of args.symbols) {
    const result = await recoverStream({
      journal: args.journal,
      snapshots: args.snapshots,
      symbol,
      spec,
      chunkSize: args.chunkSize,
    });
    results.push(result);
    streams.set(symbol, { book: result.book, lastSeq: result.lastSeq, lastTs: result.lastTs });
    lastSeqBySymbol.set(symbol, result.lastSeq);
    lastTs = Math.max(lastTs, result.lastTs);
    if (result.regenerated.length > 0) {
      regenerated.push(...result.regenerated);
    }
  }

  if (regenerated.length > 0) {
    await args.journal.appendEvents(regenerated);
  }

  return {
    recovered: {
      streams: new Map(streams),
      lastSeqBySymbol: new Map(lastSeqBySymbol),
      lastTs,
    },
    regenerated,
    results,
  };
}
