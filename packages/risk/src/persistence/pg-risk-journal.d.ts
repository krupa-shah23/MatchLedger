import type { SqlExecutor } from "@matchledger/journal";
import type { RiskEvent, RiskOutput, StampedRiskCommand } from "@matchledger/common";
export declare class PgRiskJournal {
    private readonly sql;
    private readonly partition;
    private readonly writerEpoch;
    private constructor();
    static create(sql: SqlExecutor, opts: {
        partition: number;
        writerEpoch: bigint;
    }): Promise<PgRiskJournal>;
    private streamId;
    lastCommandSeq(): Promise<number>;
    lastSeq(): Promise<number>;
    /** Appends a batch of stamped commands as ONE statement, validating per-partition
     * contiguity against the tracked lastSeq BEFORE any write. */
    append(batch: readonly StampedRiskCommand[]): Promise<void>;
    /** Appends a batch of risk outputs (events) in one transaction. For every
     * OrderAccepted event, also inserts/verifies the order_owners row atomically
     * with the event rows: if the owner conflicts, the whole transaction rolls back
     * (including the event rows), so nothing becomes durable half-way. */
    appendEvents(outputs: readonly RiskOutput[]): Promise<void>;
    readCommands(fromSeq: number, chunkSize?: number): Promise<readonly StampedRiskCommand[]>;
    readEvents(fromSeq: number, toSeq: number): Promise<ReadonlyMap<number, readonly RiskEvent[]>>;
    hasCommandForOrder(orderId: string): Promise<boolean>;
    findOrderAccepted(orderId: string): Promise<Extract<RiskEvent, {
        type: "OrderAccepted";
    }> | undefined>;
    hasSubmit(orderId: string): Promise<boolean>;
}
