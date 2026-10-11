import { BoundedQueue, type Clock, type EventSink, type JournalAppender, type ShardOutput } from "@matchledger/common";
import type { AfterBatchContext, BookPort, RecoveredState } from "@matchledger/common";
import { Engine, type Command as EngineCommand, type InstrumentConfig } from "@matchledger/engine-core";
import { Stamper } from "./stamper.js";
import { yieldToEventLoop } from "./yield.js";

export type { AfterBatchContext, BookPort, RecoveredState } from "@matchledger/common";

export type EnqueueResult = "ACCEPTED" | "FULL" | "UNKNOWN_SYMBOL" | "CLOSED";
export type RunnerState = "IDLE" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";
export type ShardExit = { reason: "STOPPED" } | { reason: "FAILED"; error: unknown };

export type BookLike = BookPort;

export type RecoveredStreamState = {
  readonly book: BookLike;
  readonly lastSeq: number;
  readonly lastTs: number;
};

export type BreakerConfigState = {
  readonly closed?: boolean;
};

export type ShardRunnerOptions = {
  readonly symbols: ReadonlyMap<string, InstrumentConfig>;
  readonly clock: Clock;
  readonly journal: JournalAppender;
  readonly sink: EventSink;
  readonly queueCapacity: number;
  readonly maxBatch: number;
  readonly yieldFn?: () => Promise<void>;
  readonly onFatal?: (error: unknown) => void;
  readonly bookFactory?: (symbol: string, spec: InstrumentConfig) => BookLike;
  readonly recovered?: RecoveredState;
  readonly afterBatch?: (ctx: AfterBatchContext) => Promise<void>;
  readonly breakerConfigs?: ReadonlyMap<string, BreakerConfigState>;
};

type Queued = { readonly symbol: string; readonly command: EngineCommand };

export class ShardRunner {
  private readonly queue: BoundedQueue<Queued>;
  private readonly stamper: Stamper;
  private readonly books = new Map<string, BookLike>();
  private readonly lastSeqBySymbol = new Map<string, number>();
  private lastTs = Number.NEGATIVE_INFINITY;
  private readonly yieldFn: () => Promise<void>;
  private readonly onFatal: (error: unknown) => void;
  private doneResolve!: (exit: ShardExit) => void;
  private readonly donePromise: Promise<ShardExit>;
  private runnerState: RunnerState = "IDLE";
  private stopDiscard = false;
  private fatalHandled = false;
  private discardedCount = 0;

  public constructor(private readonly opts: ShardRunnerOptions) {
    if (!Number.isSafeInteger(opts.queueCapacity) || opts.queueCapacity <= 0) {
      throw new RangeError("queueCapacity must be a positive integer");
    }
    if (!Number.isSafeInteger(opts.maxBatch) || opts.maxBatch <= 0) {
      throw new RangeError("maxBatch must be a positive integer");
    }
    this.queue = new BoundedQueue<Queued>(opts.queueCapacity);
    this.stamper = new Stamper(opts.clock);
    this.yieldFn = opts.yieldFn ?? yieldToEventLoop;
    this.onFatal = opts.onFatal ?? (() => undefined);
    this.donePromise = new Promise<ShardExit>((resolve) => { this.doneResolve = resolve; });
    const factory = opts.bookFactory ?? ((_symbol, spec) => new Engine(spec));
    for (const [symbol, spec] of opts.symbols) {
      const recoveredBook = opts.recovered?.streams.get(symbol)?.book;
      this.books.set(symbol, recoveredBook ?? factory(symbol, spec));
      if (recoveredBook) {
        this.lastSeqBySymbol.set(symbol, opts.recovered!.lastSeqBySymbol?.get(symbol) ?? 0);
      }
    }
    this.lastTs = opts.recovered?.lastTs ?? Number.NEGATIVE_INFINITY;
    if (opts.recovered) {
      this.stamper.restore(opts.recovered.lastSeqBySymbol ?? new Map<string, number>(), opts.recovered.lastTs);
    }
  }

  public get state(): RunnerState { return this.runnerState; }
  public get discarded(): number { return this.discardedCount; }
  public get done(): Promise<ShardExit> { return this.donePromise; }

  public symbolsNeedingTicks(): readonly string[] {
    const symbols: string[] = [];
    for (const symbol of this.opts.symbols.keys()) {
      const breakerState = this.opts.breakerConfigs?.get(symbol);
      if (breakerState?.closed === true) continue;
      const book = this.books.get(symbol);
      const maybeNeedsTick = book as { needsTick?: () => boolean } | undefined;
      const requiresTick = typeof maybeNeedsTick?.needsTick === "function"
        ? maybeNeedsTick.needsTick()
        : true;
      if (requiresTick) {
        symbols.push(symbol);
      }
    }
    return symbols;
  }

  public tryEnqueue(symbol: string, command: EngineCommand): EnqueueResult {
    if (this.runnerState === "STOPPING" || this.runnerState === "STOPPED" || this.runnerState === "FAILED" || this.queue.isClosed) {
      return "CLOSED";
    }
    if (!this.books.has(symbol)) return "UNKNOWN_SYMBOL";
    return this.queue.tryEnqueue({ symbol, command }) ? "ACCEPTED" : "FULL";
  }

  public start(): void {
    if (this.runnerState !== "IDLE") throw new Error("ShardRunner already started");
    this.runnerState = "RUNNING";
    void this.run().catch((error: unknown) => this.enterFailed(error));
  }

  public async stop(options: { readonly drain?: boolean } = {}): Promise<void> {
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

  private enterFailed(error: unknown): void {
    if (this.fatalHandled || this.runnerState === "STOPPED") return;
    this.fatalHandled = true;
    this.runnerState = "FAILED";
    this.queue.close();
    this.onFatal(error);
    this.doneResolve({ reason: "FAILED", error });
  }

  private enterStopped(): void {
    if (this.runnerState === "STOPPED" || this.runnerState === "FAILED") return;
    this.runnerState = "STOPPED";
    this.doneResolve({ reason: "STOPPED" });
  }

  private async run(): Promise<void> {
    try {
      for (;;) {
        const first = await this.queue.dequeue();
        if (first === undefined) break;
        const batch = [first, ...this.queue.drainSync(this.opts.maxBatch - 1)];

        const stamped = batch.map(item => this.stamper.stamp(item.symbol, item.command));
        await this.opts.journal.append(stamped);

        const outputs: ShardOutput[] = [];
        for (const item of stamped) {
          this.lastSeqBySymbol.set(item.symbol, item.seq);
          this.lastTs = Math.max(this.lastTs, item.ts);
          const book = this.books.get(item.symbol);
          if (!book) continue;
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
    } catch (error: unknown) {
      this.enterFailed(error);
    }
  }
}
