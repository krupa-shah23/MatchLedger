import { Bench } from "tinybench";
import { Engine } from "@matchledger/engine-core";
const config = {
    symbol: "BENCH",
    tickSize: 1n,
    lotSize: 1n,
    maxQuantity: 1000000n,
    maxPrice: 1000000n,
};
const limit = (orderId, side, price, quantity = 1n) => ({
    kind: "PLACE",
    ts: 1n,
    orderId,
    accountId: "benchmark-account",
    side,
    orderType: "LIMIT",
    timeInForce: "GTC",
    price,
    quantity,
});
const createLevelBook = () => {
    const engine = new Engine(config);
    for (let index = 0; index < 100; index += 1) {
        engine.apply(limit(`level-${index}`, "SELL", BigInt(100 + index)));
    }
    return engine;
};
let engine;
const bench = new Bench({ time: 100, warmupTime: 100 });
bench.add("add resting limit order into 100 existing levels", () => {
    engine.apply(limit("new-level", "SELL", 250n));
}, {
    beforeEach: () => {
        engine = createLevelBook();
    },
});
bench.add("match one taker against one resting maker", () => {
    engine.apply(limit("taker", "BUY", 100n));
}, {
    beforeEach: () => {
        engine = new Engine(config);
        engine.apply(limit("maker", "SELL", 100n));
    },
});
bench.add("cancel a resting order", () => {
    engine.apply({ kind: "CANCEL", ts: 2n, orderId: "cancel-me" });
}, {
    beforeEach: () => {
        engine = new Engine(config);
        engine.apply(limit("cancel-me", "BUY", 100n));
    },
});
await bench.run();
console.table(bench.table());
const runtime = globalThis;
console.log({ node: runtime.process?.version ?? "unknown" });
