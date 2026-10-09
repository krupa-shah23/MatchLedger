export class BoundedQueue<T> {
  private readonly buffer: (T | undefined)[];
  private head = 0;
  private count = 0;
  private closed = false;
  private waitingResolve: ((value: T | undefined) => void) | undefined;

  public constructor(public readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive safe integer");
    }
    this.buffer = new Array<T | undefined>(capacity);
  }

  public get size(): number {
    return this.count;
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  public tryEnqueue(item: T): boolean {
    if (this.closed) return false;
    if (this.waitingResolve !== undefined) {
      const resolve = this.waitingResolve;
      this.waitingResolve = undefined;
      resolve(item);
      return true;
    }
    if (this.count === this.capacity) return false;
    const index = (this.head + this.count) % this.capacity;
    this.buffer[index] = item;
    this.count += 1;
    return true;
  }

  public dequeue(): Promise<T | undefined> {
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
    if (this.closed) return Promise.resolve(undefined);
    return new Promise<T | undefined>((resolve) => {
      this.waitingResolve = resolve;
    });
  }

  public drainSync(max: number): T[] {
    if (!Number.isInteger(max) || max < 0) {
      throw new RangeError("max must be a non-negative integer");
    }
    const drained: T[] = [];
    const amount = Math.min(max, this.count);
    for (let index = 0; index < amount; index += 1) {
      const item = this.buffer[this.head];
      this.buffer[this.head] = undefined;
      this.head = (this.head + 1) % this.capacity;
      this.count -= 1;
      drained.push(item as T);
    }
    return drained;
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.count === 0 && this.waitingResolve !== undefined) {
      const resolve = this.waitingResolve;
      this.waitingResolve = undefined;
      resolve(undefined);
    }
  }
}
