/** Journals risk outputs durably BEFORE forwarding them downstream (e.g. to the
 * matching shard or to notice delivery). If journaling fails, downstream is never
 * called, so nothing in-memory gets ahead of what is durable. */
export class DurableRiskOutbox {
    journal;
    downstream;
    constructor(journal, downstream) {
        this.journal = journal;
        this.downstream = downstream;
    }
    async publish(partition, outputs) {
        if (outputs.length === 0)
            return;
        await this.journal.appendEvents(outputs);
        await this.downstream.publish(partition, outputs);
    }
}
