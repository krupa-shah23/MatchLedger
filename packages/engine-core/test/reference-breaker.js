import { volatilityBps } from "../src/breaker/volatility.js";
export class ReferenceBreaker {
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
        this.config = config;
    }
    value() {
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
    currentVolatility() {
        if (this.window.length !== this.config.windowTrades) {
            return 0n;
        }
        return volatilityBps(this.window);
    }
    tripOpen(ts, reason) {
        const volatility = this.currentVolatility();
        if (volatility <= this.config.tripThresholdBps) {
            return;
        }
        this.state = "OPEN";
        this.manual = false;
        this.stateSinceTs = ts;
        this.anchorPrice = this.window[0];
        this.incidentStartTs ??= ts;
        this.forceCancelled = false;
        this.halfOpenBucket.clear();
        if (reason === "HALF_OPEN_BREACH") {
            void reason;
        }
    }
    onTrades(prices, ts) {
        if (prices.length === 0) {
            return;
        }
        for (const price of prices) {
            this.window.push(price);
            if (this.window.length > this.config.windowTrades) {
                this.window.shift();
            }
        }
        if (this.state === "OPEN") {
            return;
        }
        if (this.state === "CLOSED") {
            this.tripOpen(ts, "VOLATILITY");
            return;
        }
        if (this.state === "HALF_OPEN") {
            this.tripOpen(ts, "HALF_OPEN_BREACH");
        }
    }
    advance(ts) {
        if (this.state !== "CLOSED" && this.incidentStartTs !== undefined && !this.forceCancelled && ts - this.incidentStartTs > this.config.maxHaltDurationMs) {
            this.forceCancelled = true;
            return;
        }
        if (this.state === "OPEN" && ts - this.stateSinceTs >= this.config.cooldownMs) {
            this.state = "HALF_OPEN";
            this.stateSinceTs = ts;
            this.window.length = 0;
            this.anchorPrice = undefined;
            this.halfOpenBucket.clear();
            return;
        }
        if (this.state === "HALF_OPEN" && ts - this.stateSinceTs >= this.config.halfOpenStableMs) {
            const volatility = this.currentVolatility();
            if (this.window.length < this.config.windowTrades || volatility <= this.config.resetThresholdBps) {
                const incidentStart = this.incidentStartTs ?? ts;
                this.state = "CLOSED";
                this.manual = false;
                this.window.length = 0;
                this.anchorPrice = undefined;
                this.incidentStartTs = undefined;
                this.stateSinceTs = ts;
                this.forceCancelled = false;
                this.halfOpenBucket.clear();
                void incidentStart;
            }
        }
    }
    halt(reason, ts) {
        if (this.state === "OPEN") {
            return;
        }
        this.state = "OPEN";
        this.manual = true;
        this.stateSinceTs = ts;
        this.incidentStartTs ??= ts;
        this.forceCancelled = false;
        this.window.length = 0;
        this.anchorPrice = undefined;
        this.halfOpenBucket.clear();
        if (reason) {
            void reason;
        }
    }
    resume(ts) {
        if (this.state === "OPEN" && this.manual) {
            this.state = "HALF_OPEN";
            this.stateSinceTs = ts;
            this.window.length = 0;
            this.anchorPrice = undefined;
            this.halfOpenBucket.clear();
        }
    }
    needsTick() {
        return this.state !== "CLOSED";
    }
}
