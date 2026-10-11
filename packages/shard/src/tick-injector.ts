import type { ShardRunner } from "./shard-runner.js";

export class TickInjector {
  private intervalId: ReturnType<typeof setInterval> | undefined;

  public constructor(
    private readonly runner: ShardRunner,
    private readonly symbols?: Iterable<string>,
  ) {}

  public tickOnce(): void {
    const targets = this.symbols === undefined ? this.runner.symbolsNeedingTicks() : Array.from(this.symbols).filter((symbol) => this.runner.symbolsNeedingTicks().includes(symbol));
    for (const symbol of targets) {
      const result = this.runner.tryEnqueue(symbol, { kind: "TICK", ts: 0n });
      if (result === "FULL" || result === "CLOSED" || result === "UNKNOWN_SYMBOL") {
        continue;
      }
    }
  }

  public start(intervalMs: number): void {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new RangeError("intervalMs must be a positive finite number");
    }
    if (this.intervalId !== undefined) {
      return;
    }
    this.intervalId = setInterval(() => {
      this.tickOnce();
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalId === undefined) {
      return;
    }
    clearInterval(this.intervalId);
    this.intervalId = undefined;
  }
}
