import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Engine } from "./engine.js";
const PROPERTY_TIMEOUT_MS = 60_000;
const PROPERTY_RUNS = 2_000;
const config = {
    symbol: "TST",
    tickSize: 5n,
    lotSize: 10n,
    maxQuantity: 1000n,
    maxPrice: 2000n,
};
const prices = [95n, 100n, 105n, 110n, 115n, 0n, -5n, 7n, 3000n];
const quantities = [10n, 20n, 30n, 40n, 50n, 100n, 0n, -10n, 15n, 5000n];
const orderIds = ["o0", "o1", "o2", "o3", "o4", "o5"];
const commandArbitrary = fc
    .array(fc.oneof(fc.record({
    kind: fc.constant("PLACE"),
    orderId: fc.constantFrom(...orderIds),
    accountId: fc.constantFrom("a0", "a1", "a2"),
    side: fc.constantFrom("BUY", "SELL"),
    orderType: fc.constant("LIMIT"),
    timeInForce: fc.constant("GTC"),
    price: fc.constantFrom(...prices),
    quantity: fc.constantFrom(...quantities),
}), fc.record({
    kind: fc.constant("CANCEL"),
    orderId: fc.constantFrom(...orderIds, "unknown"),
}), fc.record({ kind: fc.constant("TICK") })), { minLength: 1, maxLength: 80 })
    .map((commands) => commands.map((command, index) => ({ ...command, ts: BigInt(index) })));
const deepEqualBigint = (left, right) => {
    if (typeof left !== typeof right) {
        return false;
    }
    if (typeof left === "bigint" || typeof left === "string" || typeof left === "number" || typeof left === "boolean" || left === null) {
        return left === right;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((value, index) => deepEqualBigint(value, right[index]));
    }
    if (typeof left === "object" && typeof right === "object" && left !== null && right !== null) {
        const leftRecord = left;
        const rightRecord = right;
        const leftKeys = Object.keys(leftRecord).sort();
        const rightKeys = Object.keys(rightRecord).sort();
        return deepEqualBigint(leftKeys, rightKeys) && leftKeys.every((key) => deepEqualBigint(leftRecord[key], rightRecord[key]));
    }
    return false;
};
const expectBigintEqual = (actual, expected) => {
    expect(deepEqualBigint(actual, expected)).toBe(true);
};
class ReferenceModel {
    orders = [];
    engineSeq = 1n;
    tradeCounter = 1;
    arrivalSeq = 1n;
    apply(command) {
        if (command.kind === "TICK") {
            return [];
        }
        if (command.kind === "CANCEL") {
            const index = this.orders.findIndex((order) => order.orderId === command.orderId);
            if (index < 0) {
                return [this.event({ type: "CANCEL_REJECTED", ts: command.ts, orderId: command.orderId, reason: "ORDER_NOT_RESTING" })];
            }
            const [order] = this.orders.splice(index, 1);
            if (order === undefined) {
                throw new Error("Reference order disappeared");
            }
            return [this.event({ type: "ORDER_CANCELLED", ts: command.ts, orderId: order.orderId, remaining: order.remaining, reason: "USER_REQUEST" })];
        }
        const rejection = this.rejection(command);
        if (rejection !== undefined) {
            return [this.event({ type: "ORDER_REJECTED", ts: command.ts, orderId: command.orderId, reason: rejection })];
        }
        const arrivalSeq = this.arrivalSeq;
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
            const maker = this.bestMaker(command.side, command.price);
            if (maker === undefined) {
                break;
            }
            const fill = remaining < maker.remaining ? remaining : maker.remaining;
            events.push(this.event({
                type: "TRADE_EXECUTED",
                ts: command.ts,
                tradeId: `${config.symbol}-T${this.tradeCounter}`,
                symbol: config.symbol,
                price: maker.price,
                quantity: fill,
                takerOrderId: command.orderId,
                makerOrderId: maker.orderId,
                takerAccountId: command.accountId,
                makerAccountId: maker.accountId,
                takerSide: command.side,
            }));
            this.tradeCounter += 1;
            remaining -= fill;
            maker.remaining -= fill;
            if (maker.remaining === 0n) {
                const makerIndex = this.orders.indexOf(maker);
                this.orders.splice(makerIndex, 1);
            }
        }
        if (remaining > 0n) {
            this.orders.push({ orderId: command.orderId, accountId: command.accountId, side: command.side, price: command.price, quantity: command.quantity, remaining, arrivalSeq });
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
    view() {
        const bids = this.levels("BUY");
        const asks = this.levels("SELL");
        return {
            bids: bids.levels,
            asks: asks.levels,
            bidPrices: bids.prices,
            askPrices: asks.prices,
        };
    }
    bestMaker(side, price) {
        const candidates = this.orders
            .filter((order) => order.side !== side && (side === "BUY" ? order.price <= price : order.price >= price))
            .sort((left, right) => {
            if (left.price !== right.price) {
                return side === "BUY" ? (left.price < right.price ? -1 : 1) : left.price > right.price ? -1 : 1;
            }
            return left.arrivalSeq < right.arrivalSeq ? -1 : 1;
        });
        const bestPrice = candidates[0]?.price;
        return candidates.find((order) => order.price === bestPrice);
    }
    levels(side) {
        const levelPrices = [...new Set(this.orders.filter((order) => order.side === side).map((order) => order.price))].sort((left, right) => side === "BUY" ? (left < right ? -1 : 1) : left > right ? -1 : 1);
        const prices = levelPrices.slice();
        const levels = prices.slice().reverse().map((price) => {
            const levelOrders = this.orders.filter((order) => order.side === side && order.price === price);
            return {
                price,
                totalQuantity: levelOrders.reduce((sum, order) => sum + order.remaining, 0n),
                orders: levelOrders.map((order) => ({
                    orderId: order.orderId,
                    accountId: order.accountId,
                    remaining: order.remaining,
                    arrivalSeq: order.arrivalSeq,
                })),
            };
        });
        return { levels, prices };
    }
    rejection(command) {
        if (this.orders.some((order) => order.orderId === command.orderId))
            return "DUPLICATE_ORDER_ID";
        if (command.quantity <= 0n)
            return "INVALID_QUANTITY";
        if (command.price <= 0n)
            return "INVALID_PRICE";
        if (command.price % config.tickSize !== 0n)
            return "INVALID_TICK";
        if (command.quantity % config.lotSize !== 0n)
            return "INVALID_LOT";
        if (command.quantity > config.maxQuantity)
            return "EXCEEDS_MAX_QUANTITY";
        if (command.price > config.maxPrice)
            return "EXCEEDS_MAX_PRICE";
        return undefined;
    }
    event(input) {
        const event = { ...input, engineSeq: this.engineSeq };
        this.engineSeq += 1n;
        return event;
    }
}
const runProperty = (property) => {
    const seedText = globalThis.process?.env?.ENGINE_PROPERTY_SEED;
    const seed = seedText === undefined ? 20261009 : Number.parseInt(seedText, 10);
    const details = fc.check(property, {
        numRuns: PROPERTY_RUNS,
        seed,
        endOnFailure: true,
        verbose: true,
    });
    if (details.failed === false && details.interrupted === false && details.numRuns >= PROPERTY_RUNS) {
        return;
    }
    const counterexample = JSON.stringify(details.counterexample, (_key, value) => typeof value === "bigint" ? `${value}n` : value);
    console.error(`Property failed: seed=${details.seed}, path=${details.counterexamplePath ?? "none"}, ` +
        `failed=${details.failed}, interrupted=${details.interrupted}, numRuns=${details.numRuns}, ` +
        `counterexample=${counterexample}`);
    throw new Error("fast-check property did not complete successfully");
};
const enginesFor = () => ({
    engine: new Engine(config),
    model: new ReferenceModel(),
});
describe("engine reference-model properties", () => {
    it("P1 never crosses the book and P11 preserves price invariants", () => {
        runProperty(fc.property(commandArbitrary, (commands) => {
            const { engine } = enginesFor();
            commands.forEach((command) => {
                engine.apply(command);
                const current = engine.snapshotView();
                const bestBid = current.bidPrices.at(-1);
                const bestAsk = current.askPrices.at(-1);
                expect(bestBid === undefined || bestAsk === undefined || bestBid < bestAsk).toBe(true);
            });
            const view = engine.snapshotView();
            expect(view.bidPrices.every((price, index) => {
                const previous = view.bidPrices[index - 1];
                return previous === undefined || previous < price;
            })).toBe(true);
            expect(view.askPrices.every((price, index) => {
                const previous = view.askPrices[index - 1];
                return previous === undefined || previous > price;
            })).toBe(true);
            expect(view.bidPrices.at(-1) === undefined || view.askPrices.at(-1) === undefined || view.bidPrices.at(-1) < view.askPrices.at(-1)).toBe(true);
            expect(view.bids.map((level) => level.price).sort((left, right) => (left < right ? -1 : 1))).toEqual(view.bidPrices);
            expect(view.asks.map((level) => level.price).sort((left, right) => (left > right ? -1 : 1))).toEqual(view.askPrices);
        }));
    }, PROPERTY_TIMEOUT_MS);
    it("P2 balances buy-side and sell-side fills", () => {
        runProperty(fc.property(commandArbitrary, (commands) => {
            const engine = new Engine(config);
            let buy = 0n;
            let sell = 0n;
            commands.forEach((command) => {
                engine.apply(command).forEach((event) => {
                    if (event.type === "TRADE_EXECUTED") {
                        if (event.takerSide === "BUY") {
                            buy += event.quantity;
                            sell += event.quantity;
                        }
                        else {
                            sell += event.quantity;
                            buy += event.quantity;
                        }
                    }
                });
            });
            expect(buy).toBe(sell);
        }));
    }, PROPERTY_TIMEOUT_MS);
    it("P3, P4, engine sequences, and trade ids remain valid", () => {
        runProperty(fc.property(commandArbitrary, (commands) => {
            const engine = new Engine(config);
            const accepted = new Map();
            const filled = new Map();
            const arrivals = new Map();
            const lastMakerByPrice = new Map();
            let expectedSeq = 1n;
            let expectedTrade = 1;
            let arrivalSeq = 1n;
            commands.forEach((command) => {
                engine.apply(command).forEach((event) => {
                    expect(event.engineSeq).toBe(expectedSeq);
                    expectedSeq += 1n;
                    if (event.type === "ORDER_ACCEPTED") {
                        accepted.set(event.orderId, event.quantity);
                        filled.set(event.orderId, 0n);
                        arrivals.set(event.orderId, arrivalSeq);
                        arrivalSeq += 1n;
                    }
                    if (event.type === "TRADE_EXECUTED") {
                        const takerFilled = (filled.get(event.takerOrderId) ?? 0n) + event.quantity;
                        const makerFilled = (filled.get(event.makerOrderId) ?? 0n) + event.quantity;
                        expect(takerFilled <= (accepted.get(event.takerOrderId) ?? 0n)).toBe(true);
                        expect(makerFilled <= (accepted.get(event.makerOrderId) ?? 0n)).toBe(true);
                        filled.set(event.takerOrderId, takerFilled);
                        filled.set(event.makerOrderId, makerFilled);
                        expect(event.tradeId).toBe(`TST-T${expectedTrade}`);
                        expectedTrade += 1;
                        const makerArrival = arrivals.get(event.makerOrderId);
                        if (makerArrival !== undefined) {
                            const previous = lastMakerByPrice.get(event.price);
                            expect(previous === undefined || previous <= makerArrival).toBe(true);
                            lastMakerByPrice.set(event.price, makerArrival);
                        }
                    }
                });
                engine.snapshotView().bids.concat(engine.snapshotView().asks).forEach((level) => {
                    level.orders.forEach((order, index) => {
                        expect(order.remaining >= 0n).toBe(true);
                        const previous = level.orders[index - 1];
                        if (previous !== undefined) {
                            expect(previous.arrivalSeq < order.arrivalSeq).toBe(true);
                        }
                    });
                });
            });
        }));
    }, PROPERTY_TIMEOUT_MS);
    it("is deterministic and equivalent to the reference model after every command", () => {
        runProperty(fc.property(commandArbitrary, (commands) => {
            const first = enginesFor();
            const second = enginesFor();
            let before = first.engine.snapshotView();
            commands.forEach((command) => {
                const expected = first.model.apply(command);
                const actual = first.engine.apply(command);
                const repeat = second.engine.apply(command);
                expectBigintEqual(actual, expected);
                expectBigintEqual(repeat, actual);
                expectBigintEqual(first.engine.snapshotView(), first.model.view());
                expectBigintEqual(second.engine.snapshotView(), first.engine.snapshotView());
                if ((actual.length === 1 && (actual[0]?.type === "ORDER_REJECTED" || actual[0]?.type === "CANCEL_REJECTED"))) {
                    expectBigintEqual(first.engine.snapshotView(), before);
                }
                before = first.engine.snapshotView();
            });
        }));
    }, PROPERTY_TIMEOUT_MS);
});
