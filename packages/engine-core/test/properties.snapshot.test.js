import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { OrderBook } from "../src/book/orderBook.js";
const config = {
    symbol: "ABC",
    tickSize: 1n,
    lotSize: 1n,
    maxQuantity: 1000n,
    maxPrice: 10000n,
};
describe("snapshot properties", () => {
    it("P15 random books stay equivalent after snapshot and restore", () => {
        fc.assert(fc.property(fc.array(fc.record({
            orderId: fc.stringMatching(/^[a-z]+[0-9]{1,2}$/),
            accountId: fc.constantFrom("a1", "a2", "a3"),
            side: fc.constantFrom("BUY", "SELL"),
            price: fc.integer({ min: 90, max: 110 }).map((value) => BigInt(value)),
            remaining: fc.integer({ min: 1, max: 20 }).map((value) => BigInt(value)),
            arrivalSeq: fc.integer({ min: 1, max: 30 }).map((value) => BigInt(value)),
        }), { minLength: 1, maxLength: 30 }), (orders) => {
            const a = new OrderBook();
            orders.forEach((order) => {
                a.addResting({
                    orderId: order.orderId,
                    accountId: order.accountId,
                    side: order.side,
                    price: order.price,
                    remaining: order.remaining,
                    arrivalSeq: order.arrivalSeq,
                });
            });
            const snapshot = a.snapshot();
            const restored = OrderBook.restore(config, snapshot);
            expect(restored.view()).toEqual(a.view());
            expect(restored.checkInvariants()).toEqual([]);
        }), { numRuns: 2_000 });
    });
});
