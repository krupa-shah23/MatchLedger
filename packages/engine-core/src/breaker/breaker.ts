import type { BreakerConfig, BreakerEvent, BreakerSnapshotState, BreakerState, BreakerView } from "./types.js";
import { validateBreakerConfig } from "./types.js";
import { volatilityBps } from "./volatility.js";

export class Breaker {
  public readonly config: BreakerConfig;
  private state: BreakerState = "CLOSED";
  private manual = false;
  private readonly window: bigint[] = [];
  private anchorPrice?: bigint;
  private incidentStartTs?: number;
  private stateSinceTs = 0;
  private readonly halfOpenBucket = new Map<number, number>();
  private forceCancelled = false;

  public constructor(config: BreakerConfig) {
    validateBreakerConfig(config);
    this.config = { ...config };
  }

  private pushWindow(prices: readonly bigint[]): void {
    for (const price of prices) {
      this.window.push(price);
      if (this.window.length > this.config.windowTrades) {
        this.window.shift();
      }
    }
  }

  private currentVolatility(): bigint {
    if (this.window.length !== this.config.windowTrades) {
      return 0n;
    }
    return volatilityBps(this.window);
  }

  private tripOpen(ts: number, reason: "VOLATILITY" | "HALF_OPEN_BREACH", detail?: string): BreakerEvent[] {
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

  public advance(ts: number): BreakerEvent[] {
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

  public onTrades(prices: readonly bigint[], ts: number): BreakerEvent[] {
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

  public halt(reason: string, ts: number): BreakerEvent[] {
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

  public resume(ts: number): BreakerEvent[] {
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

  public needsTick(): boolean {
    return this.state !== "CLOSED";
  }

  public view(): BreakerView {
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

  public snapshotState(): BreakerSnapshotState {
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
