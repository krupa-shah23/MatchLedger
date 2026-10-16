export class TickInjector {
    runner;
    symbols;
    intervalId;
    constructor(runner, symbols) {
        this.runner = runner;
        this.symbols = symbols;
    }
    tickOnce() {
        const targets = this.symbols === undefined ? this.runner.symbolsNeedingTicks() : Array.from(this.symbols).filter((symbol) => this.runner.symbolsNeedingTicks().includes(symbol));
        for (const symbol of targets) {
            const result = this.runner.tryEnqueue(symbol, { kind: "TICK", ts: 0n });
            if (result === "FULL" || result === "CLOSED" || result === "UNKNOWN_SYMBOL") {
                continue;
            }
        }
    }
    start(intervalMs) {
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
    stop() {
        if (this.intervalId === undefined) {
            return;
        }
        clearInterval(this.intervalId);
        this.intervalId = undefined;
    }
}
