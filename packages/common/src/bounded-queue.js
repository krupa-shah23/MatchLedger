export class BoundedQueue {
    capacity;
    buffer;
    head = 0;
    count = 0;
    closed = false;
    waitingResolve;
    constructor(capacity) {
        this.capacity = capacity;
        if (!Number.isSafeInteger(capacity) || capacity <= 0) {
            throw new RangeError("capacity must be a positive safe integer");
        }
        this.buffer = new Array(capacity);
    }
    get size() {
        return this.count;
    }
    get isClosed() {
        return this.closed;
    }
    tryEnqueue(item) {
        if (this.closed)
            return false;
        if (this.waitingResolve !== undefined) {
            const resolve = this.waitingResolve;
            this.waitingResolve = undefined;
            resolve(item);
            return true;
        }
        if (this.count === this.capacity)
            return false;
        const index = (this.head + this.count) % this.capacity;
        this.buffer[index] = item;
        this.count += 1;
        return true;
    }
    dequeue() {
        if (this.waitingResolve !== undefined) {
            throw new Error("BoundedQueue supports one pending dequeue");
        }
        if (this.count > 0) {
            const item = this.buffer[this.head];
            this.buffer[this.head] = undefined;
            this.head = (this.head + 1) % this.capacity;
            this.count -= 1;
            return Promise.resolve(item);
        }
        if (this.closed)
            return Promise.resolve(undefined);
        return new Promise((resolve) => {
            this.waitingResolve = resolve;
        });
    }
    drainSync(max) {
        if (!Number.isInteger(max) || max < 0) {
            throw new RangeError("max must be a non-negative integer");
        }
        const drained = [];
        const amount = Math.min(max, this.count);
        for (let index = 0; index < amount; index += 1) {
            const item = this.buffer[this.head];
            this.buffer[this.head] = undefined;
            this.head = (this.head + 1) % this.capacity;
            this.count -= 1;
            drained.push(item);
        }
        return drained;
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        if (this.count === 0 && this.waitingResolve !== undefined) {
            const resolve = this.waitingResolve;
            this.waitingResolve = undefined;
            resolve(undefined);
        }
    }
}
