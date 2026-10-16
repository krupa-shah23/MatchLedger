import type { EventSink, ShardOutput } from "@matchledger/common";
export declare class DurableEventSink implements EventSink {
    private readonly journalAppendEvents;
    private readonly downstreamSink;
    constructor(journalAppendEvents: (batch: readonly ShardOutput[]) => Promise<void>, downstreamSink: EventSink);
    publish(outputs: readonly ShardOutput[]): Promise<void>;
}
