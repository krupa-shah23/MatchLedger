import type { ShardRunner } from "./shard-runner.js";
export declare class TickInjector {
    private readonly runner;
    private readonly symbols?;
    private intervalId;
    constructor(runner: ShardRunner, symbols?: Iterable<string> | undefined);
    tickOnce(): void;
    start(intervalMs: number): void;
    stop(): void;
}
