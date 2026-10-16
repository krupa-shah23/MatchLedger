import type { RiskJournalAppender, StampedRiskCommand } from "@matchledger/common";
export declare class InMemoryRiskJournal implements RiskJournalAppender {
    readonly batches: StampedRiskCommand[][];
    private holdCount;
    private failNextError;
    private readonly failOnCalls;
    private readonly schedule;
    private scheduleIndex;
    constructor(opts?: {
        readonly delaySchedule?: readonly number[];
    });
    hold(): void;
    release(): void;
    failNext(error: Error): void;
    failOnCall(n: number, error: Error): void;
    all(): readonly StampedRiskCommand[];
    append(batch: readonly StampedRiskCommand[]): Promise<void>;
}
