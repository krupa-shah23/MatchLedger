import type { BreakerConfig, BreakerEvent, BreakerSnapshotState, BreakerView } from "./types.js";
export declare class Breaker {
    readonly config: BreakerConfig;
    private state;
    private manual;
    private readonly window;
    private anchorPrice?;
    private incidentStartTs?;
    private stateSinceTs;
    private readonly halfOpenBucket;
    private forceCancelled;
    constructor(config: BreakerConfig);
    private pushWindow;
    private currentVolatility;
    private tripOpen;
    advance(ts: number): BreakerEvent[];
    onTrades(prices: readonly bigint[], ts: number): BreakerEvent[];
    halt(reason: string, ts: number): BreakerEvent[];
    resume(ts: number): BreakerEvent[];
    needsTick(): boolean;
    view(): BreakerView;
    snapshotState(): BreakerSnapshotState;
}
