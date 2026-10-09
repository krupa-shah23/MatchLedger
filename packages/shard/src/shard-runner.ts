import { BoundedQueue, type Clock, type EventSink, type JournalAppender } from "@matchledger/common";
import { Engine, type Command as EngineCommand, type Event as EngineEvent, type InstrumentConfig } from "@matchledger/engine-core";
import { Stamper } from "./stamper.js";
import { yieldToEventLoop } from "./yield.js";

export type EnqueueResult = "ACCEPTED" | "FULL" | "UNKNOWN_SYMBOL" | "CLOSED";
export type RunnerState = "IDLE" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";
export type ShardExit = { reason: "STOPPED" } | { reason: "FAILED"; error: unknown };

export interface BookLike {
  apply(command: EngineCommand): readonly EngineEvent[];
}

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
};

type Queued = { readonly symbol: string; readonly command: EngineCommand };

export class ShardRunner {
  private readonly queue: BoundedQueue<Queued>;
  private readonly stamper: Stamper;
  private readonly books = new Map<string, BookLike>();
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
    for (const [symbol, spec] of opts.symbols) this.books.set(symbol, factory(symbol, spec));
  }

  public get state(): RunnerState { return this.runnerState; }
  public get discarded(): number { return this.discardedCount; }
  public get done(): Promise<ShardExit> { return this.donePromise; }

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
    throw new Error("ShardRunner.run: hand-written (docs/WEEK-4.md 4.4)");
  }
}
