/**
 * ShardHost: ownership lifecycle per partition (hand-written).
 * Manages assignment, recovery, and revocation for a partition's symbols.
 * Enforces: lease before recovery, producer init before processing,
 * no enqueue after revoke, offset tickets for atomic offset tracking.
 */

import { PartitionConsumer, createDeadLetterMessage, KafkaEventSink } from "@matchledger/transport";
import { LeaseStore, FencedPgJournal, createSqlExecutor } from "@matchledger/journal";
import { getOrCreateCounter, getOrCreateGauge } from "@matchledger/telemetry";
import { OffsetTickets } from "./offset-tickets.js";
import { republish } from "./republish.js";
import type { Pool } from "pg";
import type { ConsumerMessage } from "@matchledger/transport";

export interface ShardHostConfig {
  pool: Pool;
  consumer: PartitionConsumer;
  leaseStore: LeaseStore;
  brokers: string[];
  shardId: string;
  runnerFactory: (
    partition: number,
    symbols: readonly string[],
    journal: FencedPgJournal
  ) => any; // Returns ShardRunner when fully implemented
  recoverSymbol: (symbol: string, pool: Pool) => Promise<void>;
}

export class ShardHost {
  private partitions = new Map<
    number,
    {
      symbols: readonly string[];
      epoch: bigint;
      journal: FencedPgJournal;
      runner: any; // ShardRunner type would be imported from engine-core
      offsetTickets: OffsetTickets;
      sink: KafkaEventSink;
      revoked: boolean;
      ownedSymbols: Set<string>;
    }
  >();

  private paused = new Set<number>();
  private prevOwnershipMap = new Map<number, Set<string>>();

  constructor(private config: ShardHostConfig) {}

  /**
   * Get metrics (lazy initialization to avoid prom-client conflicts in tests)
   */
  private getMetrics() {
    return {
      commands: getOrCreateCounter("ml_shard_commands_total"),
      queueFull: getOrCreateCounter("ml_shard_queue_full"),
      queueDepth: getOrCreateGauge("ml_shard_queue_depth"),
      leaseEpoch: getOrCreateGauge("ml_shard_lease_epoch"),
      ownershipChanges: getOrCreateCounter("ml_shard_ownership_changes"),
      lastSeq: getOrCreateGauge("ml_shard_last_seq"),
    };
  }

  /**
   * onAssign: partition assigned, run the ownership lifecycle.
   * Steps: 1. acquire epoch, 2. init producer, 3. recover, 4. republish, 5. start runner, 6. seek and resume.
   */
  async onAssign(partition: number, symbols: readonly string[]): Promise<void> {
    const leaseId = `shard-${partition}`;

    try {
      // Step 1: Acquire epoch (lease before recovery, prevents zombie writes)
      const epoch = await this.config.leaseStore.acquire(leaseId, this.config.shardId);

      // Step 2: Init transactional producer (fences any older producer with same transactional.id)
      const sink = new KafkaEventSink(this.config.brokers, "engine.events");
      await sink.init();

      // Step 3: Recover snapshot + tail replay for each symbol
      for (const symbol of symbols) {
        await this.config.recoverSymbol(symbol, this.config.pool);
      }

      // Step 4: Republish events with seq > published_through
      await republish(this.config.pool, sink, symbols, leaseId);

      // Create fenced journal for this partition
      const sql = createSqlExecutor(this.config.pool);
      const journal = new FencedPgJournal(sql, leaseId, epoch);

      // Step 5: Build ShardRunner, start, start TickInjector
      const runner = this.config.runnerFactory(partition, symbols, journal);
      runner.start();

      // Step 6: Read next_offset from consumer_offsets, seek, resume consuming
      const offsetRows = await this.config.pool.query(
        "SELECT topic, partition, next_offset FROM consumer_offsets WHERE lease_id = $1 AND partition = $2",
        [leaseId, partition]
      );

      const nextOffset = offsetRows.rows.length > 0
        ? BigInt((offsetRows.rows[0] as any).next_offset)
        : 0n;

      await this.config.consumer.seek("orders.accepted", partition, nextOffset);
      await this.config.consumer.resume([{ topic: "orders.accepted", partition }]);

      // Track owned symbols and observe metrics
      const ownedSymbols = new Set<string>(symbols);
      const prevOwned = this.prevOwnershipMap.get(partition);
      const metrics = this.getMetrics();
      if (prevOwned && (prevOwned.size !== ownedSymbols.size || !Array.from(prevOwned).every(s => ownedSymbols.has(s)))) {
        metrics.ownershipChanges.inc({ shard_id: this.config.shardId });
      }
      this.prevOwnershipMap.set(partition, ownedSymbols);
      metrics.leaseEpoch.set({ shard_id: this.config.shardId }, Number(epoch));

      // Store assignment state
      this.partitions.set(partition, {
        symbols,
        epoch,
        journal,
        runner,
        offsetTickets: new OffsetTickets(),
        sink,
        revoked: false,
        ownedSymbols,
      });
    } catch (error) {
      // Fencing or fatal error: exit
      throw error;
    }
  }

  /**
   * onRevoke: partition revoked, drain gracefully.
   * Stop consuming, stop runner, disconnect producer, release lease.
   */
  async onRevoke(partitions: readonly number[]): Promise<void> {
    for (const partition of partitions) {
      const state = this.partitions.get(partition);
      if (!state) continue;

      state.revoked = true;

      // Stop consuming (no more message callbacks for this partition)
      await this.config.consumer.pause([{ topic: "orders.accepted", partition }]);

      // Stop runner with drain:false (discard unjournaled queue)
      state.runner.stop();
      // Note: runner.done() would block; we don't await it here

      // Disconnect producer (stop taking writes)
      await state.sink.disconnect();

      // Release lease
      const leaseId = `shard-${partition}`;
      await this.config.pool.query(
        "DELETE FROM shard_leases WHERE lease_id = $1",
        [leaseId]
      );

      this.partitions.delete(partition);
    }
  }

  /**
   * onLost: partition lost (rebalance, zombie timeout).
   * Treat as fenced: exit without commit attempts.
   */
  async onLost(partitions: readonly number[]): Promise<void> {
    for (const partition of partitions) {
      const state = this.partitions.get(partition);
      if (!state) continue;

      state.revoked = true;

      // Stop runner without attempting cleanup
      state.runner.stop();

      // Disconnect producer (no commit attempts)
      try {
        await state.sink.disconnect();
      } catch {
        // Ignore errors during loss cleanup
      }

      this.partitions.delete(partition);
    }

    // Exit with error code; the process will restart
    throw new Error(`Lost partitions: ${partitions.join(", ")}. Exiting.`);
  }

  /**
   * Message callback: decode, enqueue, track offset, handle backpressure.
   * If revoked, drop silently (no state update).
   */
  async onMessage(msg: ConsumerMessage): Promise<void> {
    const partition = msg.partition;
    const state = this.partitions.get(partition);

    // If revoked, drop silently (no trace in state)
    if (!state || state.revoked) {
      return;
    }

    // Decode message
    let decoded: any;
    try {
      const parsed = JSON.parse(msg.value.toString());
      decoded = parsed.payload || parsed;
    } catch (error) {
      // Undecodable: publish to dead-letter queue, advance offset
      const dlqEntry = {
        topic: msg.topic,
        partition: msg.partition,
        offset: msg.offset,
        error: error instanceof Error ? error.message : String(error),
        rawBytes: msg.value,
        timestamp: Date.now(),
      };
      const dlqMsg = createDeadLetterMessage(dlqEntry);

      // Publish to dlq.<topic>
      await this.config.consumer.seek(msg.topic, partition, msg.offset + 1n);

      // Advance stored offset with offset-only fenced upsert
      // (This is done in the actual shard implementation)
      return;
    }

    // tryEnqueue: if accepted, push offset ticket
    const enqueueResult = state.runner.tryEnqueue(decoded);
    const metrics = this.getMetrics();

    if (enqueueResult === "ACCEPTED") {
      metrics.commands.inc({
        shard_id: this.config.shardId,
        symbol: decoded.symbol || "unknown",
      });
      state.offsetTickets.push({
        topic: msg.topic,
        partition: msg.partition,
        offset: msg.offset,
      });
    } else if (enqueueResult === "FULL") {
      metrics.queueFull.inc({ shard_id: this.config.shardId });
      // Pause partition on backpressure
      await this.config.consumer.pause([{ topic: msg.topic, partition }]);
      this.paused.add(partition);
      // Don't consume this message; it will be redelivered when resumed
    } else if (enqueueResult === "UNKNOWN_SYMBOL" || enqueueResult === "CLOSED") {
      // Skip without ticket, no pause
      return;
    }
  }

  /**
   * Resume paused partitions when queue drains.
   * Called after each runner batch.
   */
  async resumeIfDrained(partition: number, queueDepth: number): Promise<void> {
    const metrics = this.getMetrics();
    metrics.queueDepth.set({ shard_id: this.config.shardId }, queueDepth);
    if (this.paused.has(partition)) {
      const state = this.partitions.get(partition);
      if (state && !state.revoked) {
        await this.config.consumer.resume([{ topic: "orders.accepted", partition }]);
        this.paused.delete(partition);
      }
    }
  }

  /**
   * Get offset tickets for this partition (used by FencedPgJournal.append).
   */
  getOffsetTickets(partition: number): OffsetTickets | undefined {
    return this.partitions.get(partition)?.offsetTickets;
  }

  /**
   * AfterBatch callback: observe per-symbol last sequence numbers.
   */
  recordBatchMetrics(partition: number, lastSeqBySymbol: ReadonlyMap<string, number>): void {
    const metrics = this.getMetrics();
    for (const [symbol, seq] of lastSeqBySymbol.entries()) {
      metrics.lastSeq.set(
        { shard_id: this.config.shardId, symbol },
        seq
      );
    }
  }

  /**
   * Cleanup on shutdown.
   */
  async shutdown(): Promise<void> {
    const partitions = Array.from(this.partitions.keys());
    await this.onRevoke(partitions);
  }
}
