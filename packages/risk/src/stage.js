import { AsyncQueue, partitionOf } from "@matchledger/common";
import { RiskCore } from "./core/risk-core.js";
import { RiskStamper } from "./stamper.js";
export class RiskStage {
    done;
    state = "IDLE";
    partitions;
    stamper;
    options;
    stopRequested = new Set();
    fatalHandled = new Set();
    resolveDone;
    constructor(options) {
        this.options = options;
        this.stamper = new RiskStamper(options.clock);
        this.partitions = Array.from({ length: options.partitions }, (_, index) => ({
            queue: new AsyncQueue(),
            core: new RiskCore(options.config),
            journal: options.journalFor(index),
            pendingCommands: 0,
            stopped: false,
            inFlight: false,
            fatal: false,
        }));
        this.done = new Promise((resolve) => {
            this.resolveDone = resolve;
        });
    }
    submit(request) {
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
        const payload = {
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
    openAccount(accountId) {
        return this.enqueueCommand({ type: "OpenAccount", accountId });
    }
    deposit(accountId, asset, amount, requestId) {
        return this.enqueueCommand({ type: "Deposit", accountId, asset, amount, requestId });
    }
    adjust(accountId, asset, amount, adjustmentId) {
        return this.enqueueCommand({ type: "ApplyAdjustment", accountId, asset, amount, adjustmentId });
    }
    notify(notice) {
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
    probe(olderThanMs) {
        for (let index = 0; index < this.partitions.length; index += 1) {
            this.notify({ accountId: `probe:${index}`, command: { type: "SweepProbe", olderThanMs } });
        }
    }
    start() {
        if (this.state === "RUNNING") {
            return;
        }
        this.state = "RUNNING";
        for (let partition = 0; partition < this.partitions.length; partition += 1) {
            void this.runPartition(partition);
        }
    }
    async stop(opts) {
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
    core(partition) {
        return this.partitions[partition]?.core ?? (() => { throw new RangeError("Unknown partition"); })();
    }
    idle() {
        return this.partitions.every((slot) => slot.queue.size === 0 && !slot.inFlight);
    }
    enqueueCommand(command) {
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
    async runPartition(partition) {
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
                const outputs = [];
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
        }
        catch (error) {
            if (!slot.fatal) {
                slot.fatal = true;
                this.state = "FAILED";
                this.options.onFatal?.(partition, error);
            }
        }
        finally {
            slot.inFlight = false;
            if (this.partitions.every((current) => current.queue.isClosed && current.queue.size === 0)) {
                this.resolveDone();
            }
        }
    }
}
