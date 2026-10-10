import type { BookSnapshot, Command as EngineCommand, Event as EngineEvent } from "@matchledger/engine-core";

export type BookPort = {
  readonly apply: (command: EngineCommand) => readonly EngineEvent[];
  readonly snapshot?: () => BookSnapshot;
};

export type SnapshotRecord = {
  readonly stream: string;
  readonly lastSeq: number;
  readonly lastTs: number;
  readonly state: BookSnapshot;
};

export type SnapshotCandidate = {
  readonly lastSeq: number;
  readonly lastTs?: number;
  readonly state?: BookSnapshot;
  readonly invalid?: string;
  readonly symbol?: string;
  readonly version?: number;
  readonly data?: unknown;
};

export type SnapshotStore = {
  readonly save: (record: SnapshotRecord) => Promise<void>;
  readonly listCandidates: (stream: string, opts: { readonly maxSeq: number }) => Promise<readonly SnapshotCandidate[]>;
  readonly prune: (stream: string, keep: number) => Promise<void>;
};

export interface JournalReader {
  readonly lastCommandSeq: (symbol: string) => Promise<number>;
  readonly readCommands: (symbol: string, fromSeq: number, chunkSize: number) => Promise<readonly { readonly seq: number; readonly ts: number; readonly command: unknown }[]>;
  readonly readEvents: (symbol: string, fromSeq: number, toSeq: number) => Promise<readonly { readonly seq: number; readonly ts: number; readonly payload: unknown }[]>;
}

export type AfterBatchContext = {
  readonly lastSeqBySymbol: ReadonlyMap<string, number>;
  readonly lastTs: number;
  readonly books: ReadonlyMap<string, BookPort>;
};

export type RecoveredState = {
  readonly streams: ReadonlyMap<string, { readonly book: BookPort; readonly lastSeq: number; readonly lastTs?: number }>;
  readonly lastSeqBySymbol?: ReadonlyMap<string, number>;
  readonly lastTs: number;
};
