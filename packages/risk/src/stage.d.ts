import type { Clock, MarketInput, RiskCommand, RiskConfig, RiskJournalAppender, RiskOutbox } from "@matchledger/common";
import { RiskCore } from "./core/risk-core.js";
export type EnqueueResult = "ACCEPTED" | "FULL" | "CLOSED" | "UNKNOWN_PARTITION";
export type SubmitOrderRequest = {
    readonly orderId: string;
    readonly accountId: string;
    readonly symbol: string;
    readonly side: "BUY" | "SELL";
    readonly kind: "LIMIT" | "MARKET";
    readonly timeInForce: "GTC" | "IOC";
    readonly quantity: bigint;
    readonly price?: bigint;
};
export type RiskStageOptions = {
    readonly partitions: number;
    readonly config: RiskConfig;
    readonly clock: Clock;
    readonly journalFor: (partition: number) => RiskJournalAppender;
    readonly outbox: RiskOutbox;
    readonly marketInput: (symbol: string) => MarketInput;
    readonly commandCapacity: number;
    readonly maxBatch: number;
    readonly yieldFn?: () => Promise<void>;
    readonly onApplied?: (partition: number, core: RiskCore) => void;
    readonly onFatal?: (partition: number, error: unknown) => void;
};
export declare class RiskStage {
    readonly done: Promise<void>;
    state: "IDLE" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";
    private readonly partitions;
    private readonly stamper;
    private readonly options;
    private readonly stopRequested;
    private readonly fatalHandled;
    private resolveDone;
    constructor(options: RiskStageOptions);
    submit(request: SubmitOrderRequest): EnqueueResult;
    openAccount(accountId: string): EnqueueResult;
    deposit(accountId: string, asset: string, amount: bigint, requestId: string): EnqueueResult;
    adjust(accountId: string, asset: string, amount: bigint, adjustmentId: string): EnqueueResult;
    notify(notice: {
        readonly accountId: string;
        readonly command: RiskCommand;
    }): EnqueueResult;
    probe(olderThanMs: number): void;
    start(): void;
    stop(opts?: {
        readonly drain?: boolean;
    }): Promise<void>;
    core(partition: number): RiskCore;
    idle(): boolean;
    private enqueueCommand;
    private runPartition;
}
