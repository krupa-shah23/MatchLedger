import { AsyncQueue, partitionOf } from "@matchledger/common";
import type { Clock, MarketInput, RiskCommand, RiskConfig, RiskJournalAppender, RiskOutbox, RiskOutput } from "@matchledger/common";

import { RiskCore } from "./core/risk-core.js";
import { RiskStamper } from "./stamper.js";

export type EnqueueResult = "ACCEPTED" | "FULL" | "CLOSED" | "UNKNOWN_PARTITION";

export type SubmitOrderRequest = {
  readonly orderId: string;
  readonly accountId: string;
  readonly symbol: string;
  readonly side: "BUY" | "SELL";
  readonly kind: "LIMIT" | "MARKET";
  readonly timeInForce: "GTC" | "IOC";
  readonly quantity: bigint;
  readonly price?: bigint;
};

export type RiskStageOptions = {
  readonly partitions: number;
  readonly config: RiskConfig;
  readonly clock: Clock;
  readonly journalFor: (partition: number) => RiskJournalAppender;
  readonly outbox: RiskOutbox;
  readonly marketInput: (symbol: string) => MarketInput;
  readonly commandCapacity: number;
  readonly maxBatch: number;
  readonly yieldFn?: () => Promise<void>;
  readonly onApplied?: (partition: number, core: RiskCore) => void;
  readonly onFatal?: (partition: number, error: unknown) => void;
};

type PartitionItem = { readonly kind: "command" | "notice"; readonly command: RiskCommand };

type PartitionState = {
  readonly queue: AsyncQueue<PartitionItem>;
  readonly core: RiskCore;
  readonly journal: RiskJournalAppender;
  pendingCommands: number;
  stopped: boolean;
  inFlight: boolean;
  fatal: boolean;
};

export class RiskStage {
  public readonly done: Promise<void>;
  public state: "IDLE" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED" = "IDLE";

  private readonly partitions: readonly PartitionState[];
  private readonly stamper: RiskStamper;
  private readonly options: RiskStageOptions;
  private readonly stopRequested = new Set<number>();
  private readonly fatalHandled = new Set<number>();
  private resolveDone!: () => void;

  public constructor(options: RiskStageOptions) {
    this.options = options;
    this.stamper = new RiskStamper(options.clock);
    this.partitions = Array.from({ length: options.partitions }, (_, index) => ({
      queue: new AsyncQueue<PartitionItem>(),
      core: new RiskCore(options.config),
      journal: options.journalFor(index),
      pendingCommands: 0,
      stopped: false,
      inFlight: false,
      fatal: false,
    }));
    this.done = new Promise<void>((resolve) => {
      this.resolveDone = resolve;
    });
  }

  public submit(request: SubmitOrderRequest): EnqueueResult {
    if (this.state === "STOPPED" || this.state === "FAILED") {
      return "CLOSED";
    }
    const partition = partitionOf(request.accountId, this.options.partitions);
    const slot = this.partitions[partition];
    if (slot === undefined) {
      return "UNKNOWN_PARTITION";
    }
    if (slot.pendingCommands >= this.options.commandCapacity) {
      return "FULL";
    }
    slot.pendingCommands += 1;
    const payload: RiskCommand = {
      type: "SubmitOrder",
      orderId: request.orderId,
      accountId: request.accountId,
      symbol: request.symbol,
      side: request.side,
      kind: request.kind,
      timeInForce: request.timeInForce,
      quantity: request.quantity,
      price: request.price,
      market: this.options.marketInput(request.symbol),
    };
    const accepted = slot.queue.enqueue({ kind: "command", command: payload });
    if (!accepted) {
      slot.pendingCommands = Math.max(0, slot.pendingCommands - 1);
      return "CLOSED";
    }
    return "ACCEPTED";
  }

  public openAccount(accountId: string): EnqueueResult {
    return this.enqueueCommand({ type: "OpenAccount", accountId });
  }

  public deposit(accountId: string, asset: string, amount: bigint, requestId: string): EnqueueResult {
    return this.enqueueCommand({ type: "Deposit", accountId, asset, amount, requestId });
  }

  public notify(notice: { readonly accountId: string; readonly command: RiskCommand }): EnqueueResult {
    if (this.state === "STOPPED" || this.state === "FAILED") {
      return "CLOSED";
    }
    const partition = partitionOf(notice.accountId, this.options.partitions);
    const slot = this.partitions[partition];
    if (slot === undefined) {
      return "UNKNOWN_PARTITION";
    }
    const queued = slot.queue.enqueue({ kind: "notice", command: notice.command });
    return queued ? "ACCEPTED" : "CLOSED";
  }

  public probe(olderThanMs: number): void {
    for (let index = 0; index < this.partitions.length; index += 1) {
      this.notify({ accountId: `probe:${index}`, command: { type: "SweepProbe", olderThanMs } });
    }
  }

  public start(): void {
    if (this.state === "RUNNING") {
      return;
    }
    this.state = "RUNNING";
    for (let partition = 0; partition < this.partitions.length; partition += 1) {
      void this.runPartition(partition);
    }
  }

  public async stop(opts?: { readonly drain?: boolean }): Promise<void> {
    if (this.state === "STOPPED" || this.state === "FAILED") {
      return;
    }
    this.state = opts?.drain === true ? "STOPPING" : "STOPPING";
    for (const [index, slot] of this.partitions.entries()) {
      if (opts?.drain === false) {
        slot.stopped = true;
      }
      slot.queue.close();
      this.stopRequested.add(index);
    }
    await this.done;
    this.state = "STOPPED";
  }

  public core(partition: number): RiskCore {
    return this.partitions[partition]?.core ?? (() => { throw new RangeError("Unknown partition"); })();
  }

  public idle(): boolean {
    return this.partitions.every((slot) => slot.queue.size === 0 && !slot.inFlight);
  }

  private enqueueCommand(command: RiskCommand): EnqueueResult {
    if (this.state === "STOPPED" || this.state === "FAILED") {
      return "CLOSED";
    }
    if (!("accountId" in command)) {
      return "UNKNOWN_PARTITION";
    }
    const partition = partitionOf(command.accountId, this.options.partitions);
    const slot = this.partitions[partition];
    if (slot === undefined) {
      return "UNKNOWN_PARTITION";
    }
    if (slot.pendingCommands >= this.options.commandCapacity) {
      return "FULL";
    }
    slot.pendingCommands += 1;
    const accepted = slot.queue.enqueue({ kind: "command", command });
    if (!accepted) {
      slot.pendingCommands = Math.max(0, slot.pendingCommands - 1);
      return "CLOSED";
    }
    return "ACCEPTED";
  }

  private async runPartition(partition: number): Promise<void> {
    const slot = this.partitions[partition];
    if (slot === undefined) {
      return;
    }
    try {
      while (true) {
        const first = await slot.queue.dequeue();
        if (first === undefined) {
          break;
        }
        const items = [first, ...slot.queue.drainSync(Math.max(0, this.options.maxBatch - 1))];
        for (const item of items) {
          if (item.kind === "command") {
            slot.pendingCommands = Math.max(0, slot.pendingCommands - 1);
          }
        }
        slot.inFlight = true;
        const outputs: RiskOutput[] = [];
        for (const item of items) {
          const stamped = this.stamper.stamp(partition, item.command);
          await slot.journal.append([stamped]);
          const events = slot.core.apply(stamped);
          this.options.onApplied?.(partition, slot.core);
          if (events.length > 0) {
            outputs.push({ partition, seq: stamped.seq, ts: stamped.ts, command: stamped.command, events });
          }
        }
        if (outputs.length > 0) {
          await this.options.outbox.publish(partition, outputs);
        }
        if (this.options.yieldFn !== undefined) {
          await this.options.yieldFn();
        }
        slot.inFlight = false;
      }
    } catch (error) {
      if (!slot.fatal) {
        slot.fatal = true;
        this.state = "FAILED";
        this.options.onFatal?.(partition, error);
      }
    } finally {
      slot.inFlight = false;
      if (this.partitions.every((current) => current.queue.isClosed && current.queue.size === 0)) {
        this.resolveDone();
      }
    }
  }
}
