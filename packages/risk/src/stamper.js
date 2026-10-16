export class RiskStamper {
    clock;
    lastTs = new Map();
    lastSeq = new Map();
    constructor(clock) {
        this.clock = clock;
    }
    stamp(partition, command) {
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
