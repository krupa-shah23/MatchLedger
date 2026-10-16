import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BoundedQueue } from "../src/bounded-queue.js";
describe("BoundedQueue", () => {
    it("BQ1 preserves FIFO order and validates capacity", async () => {
        for (const capacity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => new BoundedQueue(capacity)).toThrow(RangeError);
        }
        const queue = new BoundedQueue(3);
        expect(queue.capacity).toBe(3);
        expect([queue.tryEnqueue(1), queue.tryEnqueue(2), queue.tryEnqueue(3)]).toEqual([true, true, true]);
        expect(await queue.dequeue()).toBe(1);
        expect(await queue.dequeue()).toBe(2);
        expect(await queue.dequeue()).toBe(3);
    });
    it("BQ2 rejects enqueue when full without changing contents", async () => {
        const queue = new BoundedQueue(2);
        expect(queue.tryEnqueue(1)).toBe(true);
        expect(queue.tryEnqueue(2)).toBe(true);
        expect(queue.tryEnqueue(3)).toBe(false);
        expect(await queue.dequeue()).toBe(1);
        expect(await queue.dequeue()).toBe(2);
    });
    it("BQ3 hands an item directly to a waiting consumer", async () => {
        const queue = new BoundedQueue(1);
        const pending = queue.dequeue();
        expect(queue.size).toBe(0);
        expect(queue.tryEnqueue(7)).toBe(true);
        await expect(pending).resolves.toBe(7);
        expect(queue.size).toBe(0);
    });
    it("BQ4 closes safely and drains queued items", async () => {
        const empty = new BoundedQueue(2);
        const pending = empty.dequeue();
        empty.close();
        empty.close();
        await expect(pending).resolves.toBeUndefined();
        expect(empty.tryEnqueue(1)).toBe(false);
        const queued = new BoundedQueue(2);
        queued.tryEnqueue(1);
        queued.tryEnqueue(2);
        queued.close();
        expect(await queued.dequeue()).toBe(1);
        expect(await queued.dequeue()).toBe(2);
        await expect(queued.dequeue()).resolves.toBeUndefined();
    });
    it("BQ5 enforces one pending consumer", async () => {
        const queue = new BoundedQueue(1);
        const first = queue.dequeue();
        expect(() => queue.dequeue()).toThrow(Error);
        queue.tryEnqueue(1);
        await expect(first).resolves.toBe(1);
        const second = queue.dequeue();
        queue.tryEnqueue(2);
        await expect(second).resolves.toBe(2);
    });
    it("BQ6 matches an array model across wrap-around operations", () => {
        const operation = fc.oneof(fc.integer({ min: 0, max: 100 }).map((value) => ({ kind: "enqueue", value })), fc.integer({ min: 0, max: 6 }).map((max) => ({ kind: "drain", max })));
        fc.assert(fc.property(fc.integer({ min: 1, max: 5 }), fc.array(operation, { minLength: 1, maxLength: 100 }), (capacity, operations) => {
            const queue = new BoundedQueue(capacity);
            const model = [];
            for (const current of operations) {
                if (current.kind === "enqueue") {
                    expect(queue.tryEnqueue(current.value)).toBe(model.length < capacity);
                    if (model.length < capacity)
                        model.push(current.value);
                }
                else {
                    const expected = model.splice(0, current.max);
                    expect(queue.drainSync(current.max)).toEqual(expected);
                }
                expect(queue.size).toBe(model.length);
            }
        }), { numRuns: 1000 });
    });
});
