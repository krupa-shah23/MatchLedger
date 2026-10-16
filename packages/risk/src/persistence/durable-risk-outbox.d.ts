import type { RiskOutbox, RiskOutput } from "@matchledger/common";
import type { PgRiskJournal } from "./pg-risk-journal.js";
/** Journals risk outputs durably BEFORE forwarding them downstream (e.g. to the
 * matching shard or to notice delivery). If journaling fails, downstream is never
 * called, so nothing in-memory gets ahead of what is durable. */
export declare class DurableRiskOutbox implements RiskOutbox {
    private readonly journal;
    private readonly downstream;
    constructor(journal: PgRiskJournal, downstream: RiskOutbox);
    publish(partition: number, outputs: readonly RiskOutput[]): Promise<void>;
}
