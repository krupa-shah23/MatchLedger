import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { AsyncQueue, acceptedToPlaceOrder, fnv1a32, partitionOf } from "../src/index.js";
describe("AsyncQueue", () => {
    it("AQ1: FIFO, pending dequeue, and close semantics", async () => {
        const queue = new AsyncQueue();
        expect(queue.enqueue(1)).toBe(true);
        expect(queue.enqueue(2)).toBe(true);
        expect(await queue.dequeue()).toBe(1);
        expect(await queue.dequeue()).toBe(2);
        const pending = queue.dequeue();
        queue.close();
        await expect(pending).resolves.toBeUndefined();
        expect(queue.size).toBe(0);
        expect(queue.isClosed).toBe(true);
        expect(queue.enqueue(3)).toBe(false);
    });
    it("AQ2: second concurrent dequeue throws", async () => {
        const queue = new AsyncQueue();
        const first = queue.dequeue();
        expect(() => queue.dequeue()).toThrow("AsyncQueue supports one pending dequeue");
        queue.enqueue(42);
        await expect(first).resolves.toBe(42);
        expect(queue.enqueue(5)).toBe(true);
        await expect(queue.dequeue()).resolves.toBe(5);
    });
    it("AQ4: plain-array model matches drainSync and dequeue behavior", async () => {
        await fc.assert(fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 200 })), async (values) => {
            const queue = new AsyncQueue();
            const expected = [];
            for (const value of values) {
                queue.enqueue(value);
                expected.push(value);
            }
            const drained = queue.drainSync(values.length);
            expect(drained).toEqual(expected);
            queue.close();
            await expect(queue.dequeue()).resolves.toBeUndefined();
        }), { numRuns: 200 });
    });
});
describe("partitionOf", () => {
    it("PT1: FNV-1a vectors and invalid partition sizes", () => {
        expect(fnv1a32("")).toBe(0x811c9dc5);
        expect(fnv1a32("a")).toBe(0xe40c292c);
        expect(fnv1a32("foobar")).toBe(0xbf9cf968);
        expect(partitionOf("a", 8)).toBeGreaterThanOrEqual(0);
        expect(partitionOf("a", 8)).toBeLessThan(8);
        expect(() => partitionOf("x", 0)).toThrow(RangeError);
        expect(() => partitionOf("x", Number.NaN)).toThrow(RangeError);
    });
    it("PT2: stability and spread", () => {
        const partitions = 8;
        const counts = new Map();
        for (let index = 0; index < 10_000; index += 1) {
            const accountId = `acct-${index}-${(BigInt(index) * 97n).toString()}`;
            const p = partitionOf(accountId, partitions);
            counts.set(p, (counts.get(p) ?? 0) + 1);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThan(partitions);
        }
        expect(counts.size).toBe(partitions);
        const average = 10_000 / partitions;
        for (const count of counts.values()) {
            expect(count).toBeGreaterThan(0);
            expect(count).toBeLessThanOrEqual(Math.ceil(average * 2));
        }
    });
});
describe("acceptedToPlaceOrder", () => {
    it("OT1: copies the accepted order into an engine command", () => {
        const accepted = {
            type: "OrderAccepted",
            orderId: "o-1",
            accountId: "acct-1",
            symbol: "ABC",
            side: "BUY",
            timeInForce: "IOC",
            price: 100n,
            quantity: 4n,
        };
        const command = acceptedToPlaceOrder(accepted);
        expect(command).toMatchObject({
            kind: "PLACE",
            ts: 0n,
            orderId: "o-1",
            accountId: "acct-1",
            side: "BUY",
            orderType: "IOC",
            timeInForce: "IOC",
            price: 100n,
            quantity: 4n,
        });
    });
});
