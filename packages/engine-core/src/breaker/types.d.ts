export type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";
export type BreakerRejectReason = "BREAKER_OPEN" | "HALF_OPEN_RATE_CAP";
export type BreakerCancelReason = "HALT_TIMEOUT";
export type BreakerConfig = {
    readonly windowTrades: number;
    readonly tripThresholdBps: bigint;
    readonly resetThresholdBps: bigint;
    readonly cooldownMs: number;
    readonly halfOpenBandBps: bigint;
    readonly halfOpenMaxOrdersPerSec: number;
    readonly halfOpenStableMs: number;
    readonly maxHaltDurationMs: number;
};
export type BreakerView = {
    readonly state: BreakerState;
    readonly manual: boolean;
    readonly window: readonly bigint[];
    readonly anchorPrice?: bigint;
    readonly incidentStartTs?: number;
    readonly stateSinceTs: number;
    readonly forceCancelled: boolean;
};
export type BreakerSnapshotState = {
    readonly state: BreakerState;
    readonly manual: boolean;
    readonly window: readonly bigint[];
    readonly anchorPrice?: bigint;
    readonly incidentStartTs?: number;
    readonly stateSinceTs: number;
    readonly halfOpenBucket: ReadonlyMap<number, number>;
    readonly forceCancelled: boolean;
};
export type TickCommand = {
    readonly type: "Tick";
    readonly ts: number;
};
export type HaltSymbolCommand = {
    readonly type: "HaltSymbol";
    readonly reason: string;
    readonly ts: number;
};
export type ResumeSymbolCommand = {
    readonly type: "ResumeSymbol";
    readonly ts: number;
};
export type BreakerCommand = TickCommand | HaltSymbolCommand | ResumeSymbolCommand;
export type BreakerEvent = {
    readonly type: "BreakerTripped";
    readonly engineSeq?: bigint;
    readonly reason: "VOLATILITY" | "HALF_OPEN_BREACH" | "MANUAL";
    readonly volatilityBps?: bigint;
    readonly thresholdBps?: bigint;
    readonly anchorPrice?: bigint;
    readonly incidentStartTs: number;
    readonly detail?: string;
    readonly ts: number;
} | {
    readonly type: "BreakerHalfOpened";
    readonly engineSeq?: bigint;
    readonly trigger: "COOLDOWN" | "RESUME";
    readonly ts: number;
} | {
    readonly type: "BreakerClosed";
    readonly engineSeq?: bigint;
    readonly incidentDurationMs: number;
    readonly ts: number;
} | {
    readonly type: "BreakerCommandIgnored";
    readonly engineSeq?: bigint;
    readonly command: "HaltSymbol" | "ResumeSymbol";
    readonly reason: string;
    readonly ts: number;
} | {
    readonly type: "HaltTimeoutCancelled";
    readonly engineSeq?: bigint;
    readonly count: number;
    readonly incidentStartTs: number;
    readonly ts: number;
};
export declare const validateBreakerConfig: (config: BreakerConfig) => void;
