import type { RiskOutbox, RiskOutput } from "@matchledger/common";
import type { PgRiskJournal } from "./pg-risk-journal.js";

/** Journals risk outputs durably BEFORE forwarding them downstream (e.g. to the
 * matching shard or to notice delivery). If journaling fails, downstream is never
 * called, so nothing in-memory gets ahead of what is durable. */
export class DurableRiskOutbox implements RiskOutbox {
  constructor(
    private readonly journal: PgRiskJournal,
    private readonly downstream: RiskOutbox,
  ) {}

  async publish(partition: number, outputs: readonly RiskOutput[]): Promise<void> {
    if (outputs.length === 0) return;
    await this.journal.appendEvents(outputs);
    await this.downstream.publish(partition, outputs);
  }
}
