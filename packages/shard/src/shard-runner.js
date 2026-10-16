import { BoundedQueue } from "@matchledger/common";
import { Engine } from "@matchledger/engine-core";
import { Stamper } from "./stamper.js";
import { yieldToEventLoop } from "./yield.js";
export class ShardRunner {
    opts;
    queue;
    stamper;
    books = new Map();
    lastSeqBySymbol = new Map();
    lastTs = Number.NEGATIVE_INFINITY;
    yieldFn;
    onFatal;
    doneResolve;
    donePromise;
    runnerState = "IDLE";
    stopDiscard = false;
    fatalHandled = false;
    discardedCount = 0;
    constructor(opts) {
        this.opts = opts;
        if (!Number.isSafeInteger(opts.queueCapacity) || opts.queueCapacity <= 0) {
            throw new RangeError("queueCapacity must be a positive integer");
        }
        if (!Number.isSafeInteger(opts.maxBatch) || opts.maxBatch <= 0) {
            throw new RangeError("maxBatch must be a positive integer");
        }
        this.queue = new BoundedQueue(opts.queueCapacity);
        this.stamper = new Stamper(opts.clock);
        this.yieldFn = opts.yieldFn ?? yieldToEventLoop;
        this.onFatal = opts.onFatal ?? (() => undefined);
        this.donePromise = new Promise((resolve) => { this.doneResolve = resolve; });
        const factory = opts.bookFactory ?? ((_symbol, spec) => new Engine(spec));
        for (const [symbol, spec] of opts.symbols) {
            const recoveredBook = opts.recovered?.streams.get(symbol)?.book;
            this.books.set(symbol, recoveredBook ?? factory(symbol, spec));
            if (recoveredBook) {
                this.lastSeqBySymbol.set(symbol, opts.recovered.lastSeqBySymbol?.get(symbol) ?? 0);
            }
        }
        this.lastTs = opts.recovered?.lastTs ?? Number.NEGATIVE_INFINITY;
        if (opts.recovered) {
            this.stamper.restore(opts.recovered.lastSeqBySymbol ?? new Map(), opts.recovered.lastTs);
        }
    }
    get state() { return this.runnerState; }
    get discarded() { return this.discardedCount; }
    get done() { return this.donePromise; }
    symbolsNeedingTicks() {
        const symbols = [];
        for (const symbol of this.opts.symbols.keys()) {
            const breakerState = this.opts.breakerConfigs?.get(symbol);
            if (breakerState?.closed === true)
                continue;
            const book = this.books.get(symbol);
            const maybeNeedsTick = book;
            const requiresTick = typeof maybeNeedsTick?.needsTick === "function"
                ? maybeNeedsTick.needsTick()
                : true;
            if (requiresTick) {
                symbols.push(symbol);
            }
        }
        return symbols;
    }
    tryEnqueue(symbol, command) {
        if (this.runnerState === "STOPPING" || this.runnerState === "STOPPED" || this.runnerState === "FAILED" || this.queue.isClosed) {
            return "CLOSED";
        }
        if (!this.books.has(symbol))
            return "UNKNOWN_SYMBOL";
        return this.queue.tryEnqueue({ symbol, command }) ? "ACCEPTED" : "FULL";
    }
    start() {
        if (this.runnerState !== "IDLE")
            throw new Error("ShardRunner already started");
        this.runnerState = "RUNNING";
        void this.run().catch((error) => this.enterFailed(error));
    }
    async stop(options = {}) {
        if (this.runnerState === "IDLE") {
            this.enterStopped();
            return;
        }
        if (this.runnerState === "STOPPED" || this.runnerState === "FAILED") {
            await this.donePromise;
            return;
        }
        this.stopDiscard = options.drain === false;
        this.runnerState = "STOPPING";
        this.queue.close();
        await this.donePromise;
    }
    enterFailed(error) {
        if (this.fatalHandled || this.runnerState === "STOPPED")
            return;
        this.fatalHandled = true;
        this.runnerState = "FAILED";
        this.queue.close();
        this.onFatal(error);
        this.doneResolve({ reason: "FAILED", error });
    }
    enterStopped() {
        if (this.runnerState === "STOPPED" || this.runnerState === "FAILED")
            return;
        this.runnerState = "STOPPED";
        this.doneResolve({ reason: "STOPPED" });
    }
    async run() {
        try {
            for (;;) {
                const first = await this.queue.dequeue();
                if (first === undefined)
                    break;
                const batch = [first, ...this.queue.drainSync(this.opts.maxBatch - 1)];
                const stamped = batch.map(item => this.stamper.stamp(item.symbol, item.command));
                await this.opts.journal.append(stamped);
                const outputs = [];
                for (const item of stamped) {
                    this.lastSeqBySymbol.set(item.symbol, item.seq);
                    this.lastTs = Math.max(this.lastTs, item.ts);
                    const book = this.books.get(item.symbol);
                    if (!book)
                        continue;
                    const events = book.apply(item.command);
                    outputs.push({ symbol: item.symbol, seq: item.seq, ts: item.ts, command: item.command, events });
                }
                await this.opts.sink.publish(outputs);
                await this.opts.afterBatch?.({
                    lastSeqBySymbol: new Map(this.lastSeqBySymbol),
                    lastTs: this.lastTs,
                    books: new Map(this.books),
                });
                await this.yieldFn();
                if (this.runnerState === "STOPPING" && this.stopDiscard) {
                    this.discardedCount = this.queue.size;
                    break;
                }
            }
            this.enterStopped();
        }
        catch (error) {
            this.enterFailed(error);
        }
    }
}
