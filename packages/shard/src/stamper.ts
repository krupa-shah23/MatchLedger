import type { Clock, StampedCommand } from "@matchledger/common";
import type { Command as EngineCommand } from "@matchledger/engine-core";

export class Stamper {
  private lastTs = Number.NEGATIVE_INFINITY;
  private readonly seqBySymbol = new Map<string, number>();

  public constructor(private readonly clock: Clock) {}

  public restore(seqBySymbol: ReadonlyMap<string, number>, lastTs: number): void {
    if (Number.isFinite(lastTs)) {
      this.lastTs = Math.max(this.lastTs, lastTs);
    }
    for (const [symbol, seq] of seqBySymbol) {
      const current = this.seqBySymbol.get(symbol) ?? 0;
      this.seqBySymbol.set(symbol, Math.max(current, seq));
    }
  }

  public stamp(symbol: string, command: EngineCommand): StampedCommand {
    const reading = this.clock.now();
    if (!Number.isFinite(reading)) {
      throw new Error("INVALID_CLOCK_READING");
    }
    this.lastTs = Math.max(this.lastTs, reading);
    const seq = (this.seqBySymbol.get(symbol) ?? 0) + 1;
    this.seqBySymbol.set(symbol, seq);
    return {
      symbol,
      seq,
      ts: this.lastTs,
      command: { ...command, ts: BigInt(this.lastTs) },
    };
  }
}
