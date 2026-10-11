import type { Clock, RiskCommand, StampedRiskCommand } from "@matchledger/common";

export class RiskStamper {
  private readonly lastTs = new Map<number, number>();
  private readonly lastSeq = new Map<number, number>();

  public constructor(private readonly clock: Clock) {}

  public stamp(partition: number, command: RiskCommand): StampedRiskCommand {
    const now = this.clock.now();
    if (!Number.isFinite(now)) {
      throw new RangeError("Clock.now() must return a finite number");
    }

    const currentTs = this.lastTs.get(partition) ?? Number.NEGATIVE_INFINITY;
    const ts = Math.max(currentTs, now);
    const seq = (this.lastSeq.get(partition) ?? 0) + 1;

    this.lastTs.set(partition, ts);
    this.lastSeq.set(partition, seq);

    return { partition, seq, ts, command };
  }
}
