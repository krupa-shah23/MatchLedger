/**
 * Hub: independent of Fastify, routes messages to subscribers
 * Handles conflation for books, queuing for others, slow client policy
 */

export interface SocketLike {
  send(data: string): void;
  readonly bufferedAmount: number;
  close(code: number, reason: string): void;
}

export interface HubMessage {
  type: string;
  topic?: string;
  epoch: string;
  seq: number;
  ts: number;
  payload: unknown;
}

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): void;
}

interface SubscriberState {
  socket: SocketLike;
  subscriptions: Set<string>; // Topics subscribed
  bufferedMessages: Map<string, HubMessage[]>; // Per-topic queues
  staleTopics: Set<string>; // Topics awaiting conflated snapshot
  pendingSnapshotSeq: Map<string, number>; // Per-topic last snapshot seq
  isStale: boolean; // Connection is above HIGH watermark
}

interface TopicSubscribers {
  subscribers: Set<SubscriberState>;
  isConflatable: boolean; // book.* topics
  sequence: number; // Gateway sequence for non-book topics
}

export class Hub {
  private subscribers: Map<string, TopicSubscribers> = new Map();
  private connections: Map<SocketLike, SubscriberState> = new Map();

  private readonly HIGH_WATERMARK = 1024 * 1024; // 1 MiB
  private readonly LOW_WATERMARK = 256 * 1024; // 256 KiB
  private readonly HARD_WATERMARK = 4 * 1024 * 1024; // 4 MiB
  private readonly MAX_QUEUE = 1000;

  private drainTimer?: ReturnType<typeof setTimeout>;
  private scheduler?: Scheduler;
  private epoch: string;

  constructor(scheduler?: Scheduler) {
    this.scheduler = scheduler;
    this.epoch = Math.random().toString(36).substring(2, 15);
  }

  /**
   * Subscribe a socket to a topic
   */
  subscribe(socket: SocketLike, topic: string): void {
    let state = this.connections.get(socket);
    if (!state) {
      state = {
        socket,
        subscriptions: new Set(),
        bufferedMessages: new Map(),
        staleTopics: new Set(),
        pendingSnapshotSeq: new Map(),
        isStale: false,
      };
      this.connections.set(socket, state);
    }

    state.subscriptions.add(topic);
    state.bufferedMessages.set(topic, []);

    // Track subscribers by topic
    let topicSubs = this.subscribers.get(topic);
    if (!topicSubs) {
      const isConflatable = topic.startsWith("book.");
      topicSubs = {
        subscribers: new Set(),
        isConflatable,
        sequence: 0,
      };
      this.subscribers.set(topic, topicSubs);
    }
    topicSubs.subscribers.add(state);
  }

  /**
   * Unsubscribe a socket from a topic
   */
  unsubscribe(socket: SocketLike, topic: string): void {
    const state = this.connections.get(socket);
    if (!state) return;

    state.subscriptions.delete(topic);
    state.bufferedMessages.delete(topic);
    state.staleTopics.delete(topic);

    const topicSubs = this.subscribers.get(topic);
    if (topicSubs) {
      topicSubs.subscribers.delete(state);
    }
  }

  /**
   * Publish a message to all subscribers of a topic
   * Never awaits a socket; enqueues synchronously
   */
  publish(message: HubMessage): void {
    const topic = message.topic;
    if (!topic) return;

    const topicSubs = this.subscribers.get(topic);
    if (!topicSubs) return;

    for (const state of topicSubs.subscribers) {
      if (!state.subscriptions.has(topic)) continue;

      // Check if above HIGH watermark
      if (state.socket.bufferedAmount > this.HIGH_WATERMARK) {
        state.isStale = true;

        // Book topics: conflate
        if (topicSubs.isConflatable) {
          state.staleTopics.add(topic);
          // Mark as stale, will send one conflated snapshot on drain
          continue;
        } else {
          // Non-book: queue up to MAX_QUEUE
          const queue = state.bufferedMessages.get(topic) || [];
          if (queue.length >= this.MAX_QUEUE) {
            // Over limit: close connection
            state.socket.close(1013, "too many buffered messages");
            this.connections.delete(state.socket);
            state.subscriptions.clear();
            continue;
          }
          queue.push(message);
          state.bufferedMessages.set(topic, queue);
          continue;
        }
      }

      // Below HIGH: send immediately
      state.isStale = false;
      state.staleTopics.delete(topic);

      try {
        const seq = topicSubs.isConflatable ? message.seq : topicSubs.sequence++;
        state.pendingSnapshotSeq.set(topic, seq); // Track for conflated snapshot on drain
        const envelope: HubMessage = {
          ...message,
          epoch: this.epoch,
          seq,
        };
        state.socket.send(JSON.stringify(envelope));
      } catch {
        // Socket error: close it
        state.socket.close(1011, "send failed");
        this.connections.delete(state.socket);
        state.subscriptions.clear();
      }
    }

    // Schedule drain check if anyone is stale
    if (Array.from(topicSubs.subscribers).some((s) => s.isStale)) {
      this.scheduleDrainCheck();
    }
  }

  /**
   * Drain check: if a stale connection has dropped below LOW, send conflated snapshots
   */
  private scheduleDrainCheck(): void {
    if (this.drainTimer) return;

    const check = () => {
      this.drainTimer = undefined;

      for (const state of this.connections.values()) {
        if (!state.isStale) continue;
        if (state.socket.bufferedAmount >= this.LOW_WATERMARK) {
          // Still above LOW: reschedule
          this.scheduleDrainCheck();
          return;
        }

        // Below LOW: send one conflated snapshot per stale topic
        state.isStale = false;
        for (const topic of state.staleTopics) {
          const topicSubs = this.subscribers.get(topic);
          if (topicSubs) {
            // Send conflated snapshot with the seq from the last snapshot sent
            const lastSeq = state.pendingSnapshotSeq.get(topic) ?? 0;
            const snapshot: HubMessage = {
              type: "snapshot",
              topic,
              epoch: this.epoch,
              seq: topicSubs.isConflatable ? lastSeq : topicSubs.sequence - 1,
              ts: Date.now(),
              payload: { conflated: true }, // Mark as conflated snapshot
            };

            try {
              state.socket.send(JSON.stringify(snapshot));
            } catch {
              state.socket.close(1011, "send failed");
              this.connections.delete(state.socket);
              state.subscriptions.clear();
              continue;
            }
          }
          state.staleTopics.delete(topic);
        }
      }
    };

    const timeout = this.scheduler?.setTimeout ?? global.setTimeout;
    this.drainTimer = (timeout as any)(check, 50) as any;
  }

  /**
   * Close a connection
   */
  closeConnection(socket: SocketLike): void {
    const state = this.connections.get(socket);
    if (!state) return;

    for (const topic of state.subscriptions) {
      this.unsubscribe(socket, topic);
    }
    this.connections.delete(socket);
  }

  /**
   * Get current epoch
   */
  getEpoch(): string {
    return this.epoch;
  }
}
