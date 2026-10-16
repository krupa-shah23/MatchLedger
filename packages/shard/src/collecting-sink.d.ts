import type { EventSink, ShardOutput } from "@matchledger/common";
export declare class CollectingSink implements EventSink {
    private readonly delaySchedule;
    readonly batches: ShardOutput[][];
    publishCalls: number;
    private held;
    private pending;
    private failureCall;
    constructor(delaySchedule?: readonly number[]);
    publish(batch: readonly ShardOutput[]): Promise<void>;
    all(): ShardOutput[];
    hold(): void;
    release(): void;
    failOnCall(call: number, error: unknown): void;
    failNext(error: unknown): void;
    private withDelay;
}
