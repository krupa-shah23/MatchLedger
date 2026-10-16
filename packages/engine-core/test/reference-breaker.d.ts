import type { BreakerConfig, BreakerState } from "../src/breaker/types.js";
export type ReferenceState = {
    readonly state: BreakerState;
    readonly manual: boolean;
    readonly window: bigint[];
    readonly anchorPrice?: bigint;
    readonly incidentStartTs?: number;
    readonly stateSinceTs: number;
    readonly halfOpenBucket: Map<number, number>;
    readonly forceCancelled: boolean;
};
export declare class ReferenceBreaker {
    private readonly config;
    private state;
    private manual;
    private readonly window;
    private anchorPrice?;
    private incidentStartTs?;
    private stateSinceTs;
    private readonly halfOpenBucket;
    private forceCancelled;
    constructor(config: BreakerConfig);
    value(): ReferenceState;
    private currentVolatility;
    private tripOpen;
    onTrades(prices: readonly bigint[], ts: number): void;
    advance(ts: number): void;
    halt(reason: string, ts: number): void;
    resume(ts: number): void;
    needsTick(): boolean;
}
