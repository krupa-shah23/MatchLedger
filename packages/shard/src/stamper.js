export class Stamper {
    clock;
    lastTs = Number.NEGATIVE_INFINITY;
    seqBySymbol = new Map();
    constructor(clock) {
        this.clock = clock;
    }
    restore(seqBySymbol, lastTs) {
        if (Number.isFinite(lastTs)) {
            this.lastTs = Math.max(this.lastTs, lastTs);
        }
        for (const [symbol, seq] of seqBySymbol) {
            const current = this.seqBySymbol.get(symbol) ?? 0;
            this.seqBySymbol.set(symbol, Math.max(current, seq));
        }
    }
    stamp(symbol, command) {
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
