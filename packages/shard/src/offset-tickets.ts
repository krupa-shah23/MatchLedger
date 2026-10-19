/**
 * OffsetTickets: FIFO of consumed Kafka offsets aligned with enqueued commands.
 * When tryEnqueue(ACCEPTED), push {topic, partition, offset}.
 * When append(batch), pop one ticket per non-Tick command; mismatch throws OW7.
 */
export interface OffsetTicket {
  topic: string;
  partition: number;
  offset: bigint;
}

export class OffsetTickets {
  private queue: OffsetTicket[] = [];

  push(ticket: OffsetTicket): void {
    this.queue.push(ticket);
  }

  /**
   * Pop one ticket per command count, in order.
   * The caller uses max(offset) + 1 for the next consume position.
   * Throws if queue.length !== commandCount (command/offset mismatch).
   */
  popBatch(commandCount: number): OffsetTicket[] {
    if (this.queue.length < commandCount) {
      throw new Error(
        `OffsetTickets mismatch: need ${commandCount} offsets, have ${this.queue.length}`
      );
    }

    const tickets = this.queue.splice(0, commandCount);
    return tickets;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}
