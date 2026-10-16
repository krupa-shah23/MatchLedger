import type { JournalAppender, StampedCommand } from "@matchledger/common";
export declare class InMemoryJournal implements JournalAppender {
    private readonly delaySchedule;
    readonly batches: StampedCommand[][];
    appendCalls: number;
    private held;
    private pending;
    private failureCall;
    constructor(delaySchedule?: readonly number[]);
    append(batch: readonly StampedCommand[]): Promise<void>;
    all(): StampedCommand[];
    hold(): void;
    release(): void;
    failOnCall(call: number, error: unknown): void;
    failNext(error: unknown): void;
    private withDelay;
}
