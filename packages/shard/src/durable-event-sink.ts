import type { EventSink, ShardOutput } from "@matchledger/common";

export class DurableEventSink implements EventSink {
  constructor(
    private readonly journalAppendEvents: (batch: readonly ShardOutput[]) => Promise<void>,
    private readonly downstreamSink: EventSink,
  ) {}

  async publish(outputs: readonly ShardOutput[]): Promise<void> {
    await this.journalAppendEvents(outputs);
    await this.downstreamSink.publish(outputs);
  }
}
