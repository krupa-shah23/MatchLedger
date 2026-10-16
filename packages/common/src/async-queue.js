export class AsyncQueue {
    buffer = [];
    closed = false;
    waitingResolve;
    get size() {
        return this.buffer.length;
    }
    get isClosed() {
        return this.closed;
    }
    enqueue(item) {
        if (this.closed)
            return false;
        if (this.waitingResolve !== undefined) {
            const resolve = this.waitingResolve;
            this.waitingResolve = undefined;
            resolve(item);
            return true;
        }
        this.buffer.push(item);
        return true;
    }
    dequeue() {
        if (this.waitingResolve !== undefined) {
            throw new Error("AsyncQueue supports one pending dequeue");
        }
        if (this.buffer.length > 0) {
            return Promise.resolve(this.buffer.shift());
        }
        if (this.closed) {
            return Promise.resolve(undefined);
        }
        return new Promise((resolve) => {
            this.waitingResolve = resolve;
        });
    }
    drainSync(max) {
        if (!Number.isInteger(max) || max < 0) {
            throw new RangeError("max must be a non-negative integer");
        }
        const amount = Math.min(max, this.buffer.length);
        return this.buffer.splice(0, amount);
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        if (this.buffer.length === 0 && this.waitingResolve !== undefined) {
            const resolve = this.waitingResolve;
            this.waitingResolve = undefined;
            resolve(undefined);
        }
    }
}
