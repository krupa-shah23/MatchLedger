import type { BreakerConfig, BreakerEvent, BreakerSnapshotState, BreakerState, BreakerView } from "./types.js";
import { validateBreakerConfig } from "./types.js";

export class Breaker {
  public readonly config: BreakerConfig;
  private state: BreakerState = "CLOSED";

  public constructor(config: BreakerConfig) {
    validateBreakerConfig(config);
    this.config = { ...config };
  }

  public advance(ts: number): BreakerEvent[] {
    void ts;
    throw new Error("TODO: hand-written");
  }

  public onTrades(prices: readonly bigint[], ts: number): BreakerEvent[] {
    void prices;
    void ts;
    throw new Error("TODO: hand-written");
  }

  public halt(reason: string, ts: number): BreakerEvent[] {
    void reason;
    void ts;
    throw new Error("TODO: hand-written");
  }

  public resume(ts: number): BreakerEvent[] {
    void ts;
    throw new Error("TODO: hand-written");
  }

  public needsTick(): boolean {
    throw new Error("TODO: hand-written");
  }

  public view(): BreakerView {
    throw new Error("TODO: hand-written");
  }

  public snapshotState(): BreakerSnapshotState {
    throw new Error("TODO: hand-written");
  }
}
