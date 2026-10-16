import { describe, it, expect } from "vitest";
import { OrderBook } from "../src/book/orderBook.js";
const spec = { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxQuantity: 1000n, maxPrice: 10000n };
describe("P7 & P8: Replay determinism", () => {
    it("P8: Replay with Date.now throwing still works", () => {
        const original = Date.now;
        Date.now = () => {
            throw new Error("No clock access");
        };
        try {
            const book = new OrderBook(spec);
            const snap = book.snapshot();
            expect(snap.symbol).toBe("ABC");
        }
        finally {
            Date.now = original;
        }
    });
});
