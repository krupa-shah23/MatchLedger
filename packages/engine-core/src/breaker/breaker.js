import { validateBreakerConfig } from "./types.js";
import { volatilityBps } from "./volatility.js";
export class Breaker {
    config;
    state = "CLOSED";
    manual = false;
    window = [];
    anchorPrice;
    incidentStartTs;
    stateSinceTs = 0;
    halfOpenBucket = new Map();
    forceCancelled = false;
    constructor(config) {
        validateBreakerConfig(config);
        this.config = { ...config };
    }
    pushWindow(prices) {
        for (const price of prices) {
            this.window.push(price);
            if (this.window.length > this.config.windowTrades) {
                this.window.shift();
            }
        }
    }
    currentVolatility() {
        if (this.window.length !== this.config.windowTrades) {
            return 0n;
        }
        return volatilityBps(this.window);
    }
    tripOpen(ts, reason, detail) {
        const volatility = this.currentVolatility();
        if (volatility <= this.config.tripThresholdBps) {
            return [];
        }
        this.state = "OPEN";
        this.manual = false;
        this.stateSinceTs = ts;
        this.anchorPrice = this.window[0];
        this.incidentStartTs ??= ts;
        this.forceCancelled = false;
        this.halfOpenBucket.clear();
        return [
            {
                type: "BreakerTripped",
                reason,
                volatilityBps: volatility,
                thresholdBps: this.config.tripThresholdBps,
                anchorPrice: this.anchorPrice,
                incidentStartTs: this.incidentStartTs,
                detail,
                ts,
            },
        ];
    }
    advance(ts) {
        if (this.state !== "CLOSED" && this.incidentStartTs !== undefined && !this.forceCancelled && ts - this.incidentStartTs > this.config.maxHaltDurationMs) {
            this.forceCancelled = true;
            return [{ type: "HaltTimeoutCancelled", count: 0, incidentStartTs: this.incidentStartTs, ts }];
        }
        if (this.state === "OPEN" && ts - this.stateSinceTs >= this.config.cooldownMs) {
            this.state = "HALF_OPEN";
            this.stateSinceTs = ts;
            this.window.length = 0;
            this.anchorPrice = undefined;
            this.halfOpenBucket.clear();
            return [{ type: "BreakerHalfOpened", trigger: "COOLDOWN", ts }];
        }
        if (this.state === "HALF_OPEN" && ts - this.stateSinceTs >= this.config.halfOpenStableMs) {
            const voltage = this.currentVolatility();
            if (this.window.length < this.config.windowTrades || voltage <= this.config.resetThresholdBps) {
                const incidentStart = this.incidentStartTs ?? ts;
                const incidentDurationMs = ts - incidentStart;
                this.state = "CLOSED";
                this.manual = false;
                this.window.length = 0;
                this.anchorPrice = undefined;
                this.incidentStartTs = undefined;
                this.stateSinceTs = ts;
                this.forceCancelled = false;
                this.halfOpenBucket.clear();
                return [{ type: "BreakerClosed", incidentDurationMs, ts }];
            }
        }
        return [];
    }
    onTrades(prices, ts) {
        if (prices.length === 0) {
            return [];
        }
        this.pushWindow(prices);
        if (this.state === "OPEN") {
            return [];
        }
        if (this.state === "CLOSED") {
            return this.tripOpen(ts, "VOLATILITY");
        }
        if (this.state === "HALF_OPEN") {
            return this.tripOpen(ts, "HALF_OPEN_BREACH");
        }
        return [];
    }
    halt(reason, ts) {
        if (this.state === "OPEN") {
            return [{ type: "BreakerCommandIgnored", command: "HaltSymbol", reason: "breaker already open", ts }];
        }
        this.state = "OPEN";
        this.manual = true;
        this.stateSinceTs = ts;
        this.incidentStartTs ??= ts;
        this.forceCancelled = false;
        this.window.length = 0;
        this.anchorPrice = undefined;
        this.halfOpenBucket.clear();
        return [{
                type: "BreakerTripped",
                reason: "MANUAL",
                incidentStartTs: this.incidentStartTs,
                detail: reason,
                ts,
            }];
    }
    resume(ts) {
        if (this.state === "OPEN" && this.manual) {
            this.state = "HALF_OPEN";
            this.stateSinceTs = ts;
            this.window.length = 0;
            this.anchorPrice = undefined;
            this.halfOpenBucket.clear();
            return [{ type: "BreakerHalfOpened", trigger: "RESUME", ts }];
        }
        return [{ type: "BreakerCommandIgnored", command: "ResumeSymbol", reason: "resume is only valid for a manual open breaker", ts }];
    }
    needsTick() {
        return this.state !== "CLOSED";
    }
    view() {
        return {
            state: this.state,
            manual: this.manual,
            window: [...this.window],
            anchorPrice: this.anchorPrice,
            incidentStartTs: this.incidentStartTs,
            stateSinceTs: this.stateSinceTs,
            forceCancelled: this.forceCancelled,
        };
    }
    snapshotState() {
        return {
            state: this.state,
            manual: this.manual,
            window: [...this.window],
            anchorPrice: this.anchorPrice,
            incidentStartTs: this.incidentStartTs,
            stateSinceTs: this.stateSinceTs,
            halfOpenBucket: new Map(this.halfOpenBucket),
            forceCancelled: this.forceCancelled,
        };
    }
}
