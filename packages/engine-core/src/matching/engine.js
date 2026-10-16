import { OrderBook } from "../book/orderBook.js";
export class Engine {
    config;
    book = new OrderBook();
    engineSeq = 1n;
    tradeCounter = 1n;
    arrivalSeq = 1n;
    constructor(config) {
        if (config.tickSize <= 0n ||
            config.lotSize <= 0n ||
            config.maxQuantity <= 0n ||
            config.maxPrice <= 0n) {
            throw new RangeError("Instrument configuration values must be positive");
        }
        this.config = config;
    }
    apply(command) {
        if (command.kind === "TICK") {
            return this.applyTick();
        }
        if (command.kind === "CANCEL") {
            return this.applyCancel(command);
        }
        return this.applyPlace(command);
    }
    checkInvariants() {
        return this.book.checkInvariants();
    }
    depth(side, n) {
        return this.book.depth(side, n);
    }
    restingOrders() {
        return this.book.restingOrders();
    }
    snapshotView() {
        return this.book.view();
    }
    applyTick() {
        return [];
    }
    applyPlace(command) {
        const rejection = this.rejectionReason(command);
        if (rejection !== undefined) {
            return [
                this.event({
                    type: "ORDER_REJECTED",
                    ts: command.ts,
                    orderId: command.orderId,
                    reason: rejection,
                }),
            ];
        }
        const orderArrivalSeq = this.arrivalSeq;
        this.arrivalSeq += 1n;
        const events = [
            this.event({
                type: "ORDER_ACCEPTED",
                ts: command.ts,
                orderId: command.orderId,
                accountId: command.accountId,
                side: command.side,
                orderType: command.orderType,
                price: command.price,
                quantity: command.quantity,
            }),
        ];
        let remaining = command.quantity;
        while (remaining > 0n) {
            const makerLevel = this.book.bestLevel(this.opposite(command.side));
            if (makerLevel === undefined || !this.crosses(command.side, command.price, makerLevel.price)) {
                break;
            }
            const maker = makerLevel.head;
            if (maker === undefined) {
                throw new Error("Best level is empty");
            }
            const fill = remaining < maker.remaining ? remaining : maker.remaining;
            events.push(this.event({
                type: "TRADE_EXECUTED",
                ts: command.ts,
                tradeId: `${this.config.symbol}-T${this.tradeCounter.toString()}`,
                symbol: this.config.symbol,
                price: maker.price,
                quantity: fill,
                takerOrderId: command.orderId,
                makerOrderId: maker.orderId,
                takerAccountId: command.accountId,
                makerAccountId: maker.accountId,
                takerSide: command.side,
            }));
            this.tradeCounter += 1n;
            remaining -= fill;
            this.book.reduceMaker(maker, fill);
            if (maker.remaining === 0n) {
                this.book.cancel(maker.orderId);
            }
        }
        if (remaining > 0n && command.timeInForce === "IOC") {
            events.push(this.event({
                type: "ORDER_CANCELLED",
                ts: command.ts,
                orderId: command.orderId,
                remaining,
                reason: "IOC_REMAINDER",
            }));
        }
        else if (remaining > 0n) {
            this.book.addResting({
                orderId: command.orderId,
                accountId: command.accountId,
                side: command.side,
                price: command.price,
                remaining,
                arrivalSeq: orderArrivalSeq,
            });
            events.push(this.event({
                type: "ORDER_RESTED",
                ts: command.ts,
                orderId: command.orderId,
                side: command.side,
                price: command.price,
                remaining,
            }));
        }
        return events;
    }
    applyCancel(command) {
        const node = this.book.cancel(command.orderId);
        if (node === undefined) {
            return [
                this.event({
                    type: "CANCEL_REJECTED",
                    ts: command.ts,
                    orderId: command.orderId,
                    reason: "ORDER_NOT_RESTING",
                }),
            ];
        }
        return [
            this.event({
                type: "ORDER_CANCELLED",
                ts: command.ts,
                orderId: command.orderId,
                remaining: node.remaining,
                reason: "USER_REQUEST",
            }),
        ];
    }
    rejectionReason(command) {
        if (this.book.has(command.orderId)) {
            return "DUPLICATE_ORDER_ID";
        }
        if (command.quantity <= 0n) {
            return "INVALID_QUANTITY";
        }
        if (command.price <= 0n) {
            return "INVALID_PRICE";
        }
        if (command.price % this.config.tickSize !== 0n) {
            return "INVALID_TICK";
        }
        if (command.quantity % this.config.lotSize !== 0n) {
            return "INVALID_LOT";
        }
        if (command.quantity > this.config.maxQuantity) {
            return "EXCEEDS_MAX_QUANTITY";
        }
        if (command.price > this.config.maxPrice) {
            return "EXCEEDS_MAX_PRICE";
        }
        return undefined;
    }
    event(input) {
        const event = { ...input, engineSeq: this.engineSeq };
        this.engineSeq += 1n;
        return event;
    }
    opposite(side) {
        return side === "BUY" ? "SELL" : "BUY";
    }
    crosses(side, price, makerPrice) {
        return side === "BUY" ? makerPrice <= price : makerPrice >= price;
    }
}
