export class SeqDeduper {
    seen = new Map();
    accept(symbol, seq) {
        const last = this.seen.get(symbol) ?? 0;
        if (seq <= last)
            return false;
        if (seq !== last + 1)
            throw new Error(`Gap in ${symbol}: expected ${last + 1}, got ${seq}`);
        this.seen.set(symbol, seq);
        return true;
    }
}
