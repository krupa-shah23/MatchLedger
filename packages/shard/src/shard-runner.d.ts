import { type Clock, type EventSink, type JournalAppender } from "@matchledger/common";
import type { AfterBatchContext, BookPort, RecoveredState } from "@matchledger/common";
import { type Command as EngineCommand, type InstrumentConfig } from "@matchledger/engine-core";
export type { AfterBatchContext, BookPort, RecoveredState } from "@matchledger/common";
export type EnqueueResult = "ACCEPTED" | "FULL" | "UNKNOWN_SYMBOL" | "CLOSED";
export type RunnerState = "IDLE" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";
export type ShardExit = {
    reason: "STOPPED";
} | {
    reason: "FAILED";
    error: unknown;
};
export type BookLike = BookPort;
export type RecoveredStreamState = {
    readonly book: BookLike;
    readonly lastSeq: number;
    readonly lastTs: number;
};
export type BreakerConfigState = {
    readonly closed?: boolean;
};
export type ShardRunnerOptions = {
    readonly symbols: ReadonlyMap<string, InstrumentConfig>;
    readonly clock: Clock;
    readonly journal: JournalAppender;
    readonly sink: EventSink;
    readonly queueCapacity: number;
    readonly maxBatch: number;
    readonly yieldFn?: () => Promise<void>;
    readonly onFatal?: (error: unknown) => void;
    readonly bookFactory?: (symbol: string, spec: InstrumentConfig) => BookLike;
    readonly recovered?: RecoveredState;
    readonly afterBatch?: (ctx: AfterBatchContext) => Promise<void>;
    readonly breakerConfigs?: ReadonlyMap<string, BreakerConfigState>;
};
export declare class ShardRunner {
    private readonly opts;
    private readonly queue;
    private readonly stamper;
    private readonly books;
    private readonly lastSeqBySymbol;
    private lastTs;
    private readonly yieldFn;
    private readonly onFatal;
    private doneResolve;
    private readonly donePromise;
    private runnerState;
    private stopDiscard;
    private fatalHandled;
    private discardedCount;
    constructor(opts: ShardRunnerOptions);
    get state(): RunnerState;
    get discarded(): number;
    get done(): Promise<ShardExit>;
    symbolsNeedingTicks(): readonly string[];
    tryEnqueue(symbol: string, command: EngineCommand): EnqueueResult;
    start(): void;
    stop(options?: {
        readonly drain?: boolean;
    }): Promise<void>;
    private enterFailed;
    private enterStopped;
    private run;
}
