import type { BreakerConfig, InstrumentSpec } from "@matchledger/engine-core";
import type { JournalReader, RecoveredState, ShardOutput, SnapshotStore } from "@matchledger/common";
export type { JournalReader, RecoveredState, SnapshotCandidate, SnapshotStore } from "@matchledger/common";
export type PgJournal = JournalReader & {
    readonly append: (batch: readonly unknown[]) => Promise<void>;
    readonly appendEvents: (batch: readonly ShardOutput[]) => Promise<void>;
};
export declare class JournalGapError extends Error {
    readonly symbol: string;
    readonly expected: number;
    readonly got: number;
    constructor(symbol: string, expected: number, got: number);
}
export declare class ReplayMismatchError extends Error {
    readonly symbol: string;
    readonly seq: number;
    readonly expected: unknown;
    readonly actual: unknown;
    readonly diff: string;
    constructor(symbol: string, seq: number, expected: unknown, actual: unknown, diff: string);
}
type ReplayBook = {
    readonly apply: (command: unknown) => readonly unknown[];
    readonly checkInvariants: () => string[];
};
export type RecoveryResult = {
    readonly symbol: string;
    readonly book: ReplayBook;
    readonly lastSeq: number;
    readonly lastTs: number;
    readonly replayed: number;
    readonly verified: number;
    readonly regenerated: readonly ShardOutput[];
    readonly snapshotUsed?: {
        readonly lastSeq: number;
    };
    readonly invalidSnapshots: readonly {
        readonly lastSeq: number;
        readonly reason: string;
    }[];
};
export type RecoveredStreamState = {
    readonly book: ReplayBook;
    readonly lastSeq: number;
    readonly lastTs: number;
};
export declare function recoverStream(args: {
    readonly journal: PgJournal;
    readonly snapshots: SnapshotStore;
    readonly symbol: string;
    readonly spec: InstrumentSpec;
    readonly breakerConfig?: BreakerConfig;
    readonly chunkSize?: number;
}): Promise<RecoveryResult>;
export declare function recoverShard(args: {
    readonly journal: PgJournal;
    readonly snapshots: SnapshotStore;
    readonly symbols: ReadonlyMap<string, InstrumentSpec>;
    readonly chunkSize?: number;
}): Promise<{
    readonly recovered: RecoveredState;
    readonly regenerated: readonly ShardOutput[];
    readonly results: readonly RecoveryResult[];
}>;
