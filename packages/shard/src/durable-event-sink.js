export class DurableEventSink {
    journalAppendEvents;
    downstreamSink;
    constructor(journalAppendEvents, downstreamSink) {
        this.journalAppendEvents = journalAppendEvents;
        this.downstreamSink = downstreamSink;
    }
    async publish(outputs) {
        await this.journalAppendEvents(outputs);
        await this.downstreamSink.publish(outputs);
    }
}
