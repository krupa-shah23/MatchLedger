import type { Command as EngineCommand, Event as EngineEvent } from "@matchledger/engine-core";

/** Supplies the current wall-clock time to an impure boundary. */
export interface Clock {
  /** Returns milliseconds; callers own monotonicity and stamping policy. */
  now(): number;
}

/** A command stamped once for a symbol stream before journaling. */
export type StampedCommand = {
  /** Symbol stream identifier. */
  readonly symbol: string;
  /** Contiguous per-symbol sequence starting at one. */
  readonly seq: number;
  /** Non-decreasing timestamp across the shard. */
  readonly ts: number;
  /** Engine command with its timestamp overwritten by the stamper. */
  readonly command: EngineCommand;
};

/** A journaled command and the events produced by the synchronous engine. */
export type ShardOutput = {
  /** Symbol stream identifier. */
  readonly symbol: string;
  /** Per-symbol command sequence. */
  readonly seq: number;
  /** Stamped command timestamp. */
  readonly ts: number;
  /** Command applied to the engine. */
  readonly command: EngineCommand;
  /** Events emitted by the engine. */
  readonly events: readonly EngineEvent[];
};

/** Durable append port for an ordered all-or-nothing batch. */
export interface JournalAppender {
  /** Resolves only after the whole batch is durable and rejects on failure. */
  append(batch: readonly StampedCommand[]): Promise<void>;
}

/** Event handoff port preserving the order of each output batch. */
export interface EventSink {
  /** Resolves after the batch has been handed off in order. */
  publish(batch: readonly ShardOutput[]): Promise<void>;
}
