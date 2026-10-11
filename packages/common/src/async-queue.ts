export class AsyncQueue<T> {
  private readonly buffer: T[] = [];
  private closed = false;
  private waitingResolve: ((value: T | undefined) => void) | undefined;

  public get size(): number {
    return this.buffer.length;
  }

  public get isClosed(): boolean {
    return this.closed
  }

  public enqueue(item: T): boolean {
    if (this.closed) return false;
    if (this.waitingResolve !== undefined) {
      const resolve = this.waitingResolve;
      this.waitingResolve = undefined;
      resolve(item);
      return true;
    }
    this.buffer.push(item);
    return true;
  }

  public dequeue(): Promise<T | undefined> {
    if (this.waitingResolve !== undefined) {
      throw new Error("AsyncQueue supports one pending dequeue");
    }
    if (this.buffer.length > 0) {
      return Promise.resolve(this.buffer.shift() as T);
    }
    if (this.closed) {
      return Promise.resolve(undefined);
    }
    return new Promise<T | undefined>((resolve) => {
      this.waitingResolve = resolve;
    });
  }

  public drainSync(max: number): T[] {
    if (!Number.isInteger(max) || max < 0) {
      throw new RangeError("max must be a non-negative integer");
    }
    const amount = Math.min(max, this.buffer.length);
    return this.buffer.splice(0, amount);
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.buffer.length === 0 && this.waitingResolve !== undefined) {
      const resolve = this.waitingResolve;
      this.waitingResolve = undefined;
      resolve(undefined);
    }
  }
}
