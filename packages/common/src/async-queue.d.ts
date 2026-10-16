export declare class AsyncQueue<T> {
    private readonly buffer;
    private closed;
    private waitingResolve;
    get size(): number;
    get isClosed(): boolean;
    enqueue(item: T): boolean;
    dequeue(): Promise<T | undefined>;
    drainSync(max: number): T[];
    close(): void;
}
