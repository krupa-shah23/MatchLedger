export declare class BoundedQueue<T> {
    readonly capacity: number;
    private readonly buffer;
    private head;
    private count;
    private closed;
    private waitingResolve;
    constructor(capacity: number);
    get size(): number;
    get isClosed(): boolean;
    tryEnqueue(item: T): boolean;
    dequeue(): Promise<T | undefined>;
    drainSync(max: number): T[];
    close(): void;
}
