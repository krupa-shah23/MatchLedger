/**
 * Pure resync reducer for the live WebSocket topics (book.*, trades.*, user.*,
 * breaker, risk.rejections, system). One instance covers every subscribed topic.
 *
 * reduce(state, message) -> { state, effects }
 *
 * Rules (WEEK-11.md section 4.9):
 * - A delta whose epoch differs from the topic's stored epoch means the stream
 *   was re-sharded or re-owned: resync, don't try to reconcile it.
 * - A snapshot marked `conflated` replaces state outright; it is not a delta.
 * - book.* seq is durable-engine seq: monotonic but not necessarily contiguous,
 *   so a gap alone is not a resync trigger. Only a lower-or-equal seq is dropped.
 * - user.*, breaker, risk.rejections, system seq must be contiguous; any gap
 *   (seq > last + 1) forces a resync, because these topics are not safe to miss.
 * - The reducer never reads a clock, timer, or random source: reconnect backoff
 *   and the WebSocket itself live in the hook that calls this, not here.
 */

export type TopicStatus = "idle" | "syncing" | "live" | "stale";

export interface TopicState {
  epoch: number | null;
  seq: number | null;
  status: TopicStatus;
  conflated: boolean;
  snapshot: unknown;
}

export interface StreamState {
  topics: Record<string, TopicState>;
}

export type IncomingMessage =
  | { kind: "snapshot"; topic: string; epoch: number; seq: number; conflated?: boolean; data: unknown }
  | { kind: "delta"; topic: string; epoch: number; seq: number; data: unknown }
  | { kind: "disconnect" }
  | { kind: "close"; code: number };

export type Effect =
  | { type: "REFETCH_SNAPSHOT"; topic: string }
  | { type: "REFETCH_ALL" }
  | { type: "LOGOUT" }
  | { type: "RECONNECT" };

export interface StreamResult {
  state: StreamState;
  effects: Effect[];
}

export function createInitialState(): StreamState {
  return { topics: {} };
}

function isBookTopic(topic: string): boolean {
  return topic.startsWith("book.") || topic.startsWith("trades.");
}

function withTopic(state: StreamState, topic: string, next: TopicState): StreamState {
  return { topics: { ...state.topics, [topic]: next } };
}

export function reduce(state: StreamState, message: IncomingMessage): StreamResult {
  switch (message.kind) {
    case "snapshot": {
      const next: TopicState = {
        epoch: message.epoch,
        seq: message.seq,
        status: "live",
        conflated: message.conflated === true,
        snapshot: message.data,
      };
      return { state: withTopic(state, message.topic, next), effects: [] };
    }

    case "delta": {
      const existing = state.topics[message.topic];
      if (!existing) {
        return { state, effects: [{ type: "REFETCH_SNAPSHOT", topic: message.topic }] };
      }

      if (existing.epoch !== message.epoch) {
        const syncing: TopicState = { ...existing, status: "syncing" };
        return {
          state: withTopic(state, message.topic, syncing),
          effects: [{ type: "REFETCH_SNAPSHOT", topic: message.topic }],
        };
      }

      if (isBookTopic(message.topic)) {
        if (existing.seq !== null && message.seq <= existing.seq) {
          return { state, effects: [] };
        }
        const live: TopicState = { ...existing, seq: message.seq, snapshot: message.data, status: "live" };
        return { state: withTopic(state, message.topic, live), effects: [] };
      }

      const hasGap = existing.seq !== null && message.seq > existing.seq + 1;
      if (hasGap) {
        const syncing: TopicState = { ...existing, status: "syncing" };
        return {
          state: withTopic(state, message.topic, syncing),
          effects: [{ type: "REFETCH_SNAPSHOT", topic: message.topic }],
        };
      }
      const live: TopicState = { ...existing, seq: message.seq, snapshot: message.data, status: "live" };
      return { state: withTopic(state, message.topic, live), effects: [] };
    }

    case "disconnect": {
      const topics: Record<string, TopicState> = {};
      for (const [topic, topicState] of Object.entries(state.topics)) {
        topics[topic] = { ...topicState, status: "stale" };
      }
      return { state: { topics }, effects: [{ type: "RECONNECT" }] };
    }

    case "close": {
      if (message.code === 4401) {
        return { state, effects: [{ type: "LOGOUT" }] };
      }
      if (message.code === 1013) {
        return { state, effects: [{ type: "REFETCH_ALL" }, { type: "RECONNECT" }] };
      }
      if (message.code === 1001) {
        return { state, effects: [{ type: "RECONNECT" }] };
      }
      return { state, effects: [] };
    }
  }
}
