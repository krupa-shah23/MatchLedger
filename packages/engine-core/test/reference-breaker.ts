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

export class ReferenceBreaker {
  private readonly config: BreakerConfig;
  private state: BreakerState = "CLOSED";
  private manual = false;
  private readonly window: bigint[] = [];
  private anchorPrice?: bigint;
  private incidentStartTs?: number;
  private stateSinceTs = 0;
  private readonly halfOpenBucket = new Map<number, number>();
  private forceCancelled = false;

  public constructor(config: BreakerConfig) {
    this.config = config;
  }

  public value(): ReferenceState {
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

  public onTrades(prices: readonly bigint[], ts: number): void {
    if (prices.length === 0) {
      return;
    }
    for (const price of prices) {
      this.window.push(price);
      if (this.window.length > this.config.windowTrades) {
        this.window.shift();
      }
    }
    this.stateSinceTs = ts;
  }

  public advance(ts: number): void {
    this.stateSinceTs = ts;
  }

  public halt(reason: string, ts: number): void {
    this.manual = true;
    this.state = "OPEN";
    this.stateSinceTs = ts;
    this.incidentStartTs ??= ts;
    this.forceCancelled = false;
    if (reason) {
      void reason;
    }
  }

  public resume(ts: number): void {
    if (this.state === "OPEN" && this.manual) {
      this.state = "HALF_OPEN";
      this.stateSinceTs = ts;
      this.window.length = 0;
      this.halfOpenBucket.clear();
    }
  }

  public needsTick(): boolean {
    return this.state !== "CLOSED";
  }
}
