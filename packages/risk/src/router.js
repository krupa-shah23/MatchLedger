import { SeqDeduper } from "@matchledger/common";
export class EngineEventRouter {
    counters = {
        duplicateOutputs: 0,
        unknownOrderEvents: 0,
    };
    owners = new Map();
    sweepCancels = new Set();
    deduper;
    localSeq = new Map();
    constructor(opts) {
        this.marketView = opts.marketView;
        this.deduper = opts.dedupe;
    }
    marketView;
    registerOrder(orderId, owner) {
        this.owners.set(orderId, owner);
    }
    markSweepCancel(orderId) {
        this.sweepCancels.add(orderId);
    }
    ownerOf(orderId) {
        return this.owners.get(orderId);
    }
    onShardOutputs(outputs) {
        const notices = [];
        const trades = [];
        let ignoredOrders = 0;
        for (const output of outputs) {
            if (!this.acceptOutput(output)) {
                this.counters.duplicateOutputs += 1;
                continue;
            }
            for (const event of output.events) {
                this.marketView.apply(output.symbol, event, output.ts);
                switch (event.type) {
                    case "ORDER_RESTED": {
                        const owner = this.ownerOf(event.orderId);
                        if (owner === undefined) {
                            this.counters.unknownOrderEvents += 1;
                            ignoredOrders += 1;
                            continue;
                        }
                        notices.push({
                            accountId: owner.accountId,
                            command: { type: "OrderAcked", orderId: event.orderId },
                        });
                        break;
                    }
                    case "TRADE_EXECUTED": {
                        const takerOwner = this.ownerOf(event.takerOrderId);
                        const makerOwner = this.ownerOf(event.makerOrderId);
                        if (takerOwner === undefined || makerOwner === undefined) {
                            this.counters.unknownOrderEvents += 1;
                            ignoredOrders += 1;
                            continue;
                        }
                        const takerNotice = {
                            accountId: takerOwner.accountId,
                            command: {
                                type: "FillApplied",
                                orderId: event.takerOrderId,
                                tradeId: event.tradeId,
                                price: event.price,
                                quantity: event.quantity,
                            },
                        };
                        const makerNotice = {
                            accountId: makerOwner.accountId,
                            command: {
                                type: "FillApplied",
                                orderId: event.makerOrderId,
                                tradeId: event.tradeId,
                                price: event.price,
                                quantity: event.quantity,
                            },
                        };
                        notices.push(takerNotice, makerNotice);
                        const takerSide = event.takerSide;
                        const buyerAccountId = takerSide === "BUY" ? takerOwner.accountId : makerOwner.accountId;
                        const sellerAccountId = takerSide === "BUY" ? makerOwner.accountId : takerOwner.accountId;
                        trades.push({
                            tradeId: event.tradeId,
                            symbol: output.symbol,
                            price: event.price,
                            quantity: event.quantity,
                            buyerAccountId,
                            sellerAccountId,
                            ts: output.ts,
                        });
                        const takerRemaining = event.takerRemaining;
                        const makerRemaining = event.makerRemaining;
                        if (takerRemaining !== undefined && takerRemaining === 0n) {
                            this.owners.delete(event.takerOrderId);
                        }
                        if (makerRemaining !== undefined && makerRemaining === 0n) {
                            this.owners.delete(event.makerOrderId);
                        }
                        break;
                    }
                    case "ORDER_CANCELLED": {
                        const owner = this.ownerOf(event.orderId);
                        if (owner === undefined) {
                            this.counters.unknownOrderEvents += 1;
                            ignoredOrders += 1;
                            continue;
                        }
                        const reason = event.reason === "IOC_REMAINDER" ? "IOC_REMAINDER" : event.reason === "HALT_TIMEOUT" ? "HALT_TIMEOUT" : "CANCELLED";
                        notices.push({
                            accountId: owner.accountId,
                            command: {
                                type: "OrderClosed",
                                orderId: event.orderId,
                                remaining: event.remaining,
                                reason,
                            },
                        });
                        this.owners.delete(event.orderId);
                        this.sweepCancels.delete(event.orderId);
                        break;
                    }
                    case "ORDER_REJECTED": {
                        const owner = this.ownerOf(event.orderId);
                        if (owner === undefined) {
                            this.counters.unknownOrderEvents += 1;
                            ignoredOrders += 1;
                            continue;
                        }
                        notices.push({
                            accountId: owner.accountId,
                            command: {
                                type: "OrderRejectedByMatcher",
                                orderId: event.orderId,
                                reason: event.reason,
                            },
                        });
                        this.owners.delete(event.orderId);
                        this.sweepCancels.delete(event.orderId);
                        break;
                    }
                    case "CANCEL_REJECTED": {
                        const owner = this.ownerOf(event.orderId);
                        if (this.sweepCancels.has(event.orderId)) {
                            if (owner !== undefined) {
                                notices.push({
                                    accountId: owner.accountId,
                                    command: { type: "ReleaseUnreached", orderId: event.orderId },
                                });
                            }
                            this.owners.delete(event.orderId);
                            this.sweepCancels.delete(event.orderId);
                            break;
                        }
                        if (owner !== undefined) {
                            this.counters.unknownOrderEvents += 1;
                            ignoredOrders += 1;
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        }
        return { notices, trades, ignoredOrders };
    }
    acceptOutput(output) {
        if (this.deduper !== undefined) {
            return this.deduper.accept(output.symbol, output.seq);
        }
        const last = this.localSeq.get(output.symbol) ?? 0;
        if (output.seq <= last) {
            return false;
        }
        if (output.seq !== last + 1) {
            throw new Error(`Gap in ${output.symbol}: expected ${last + 1}, got ${output.seq}`);
        }
        this.localSeq.set(output.symbol, output.seq);
        return true;
    }
}
