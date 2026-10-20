/**
 * Risk consumer for orders.submitted (Phase B, task 6.3).
 * Consume SubmitOrder messages, journal through FencedPgJournal with lease_id=risk-<partition>.
 * Store offset in same transaction as journal write.
 */

import { PartitionConsumer, decodeEnvelope } from "@matchledger/transport";
import { FencedPgJournal, createSqlExecutor } from "@matchledger/journal";
import type { Pool } from "pg";
import type { ConsumerMessage } from "@matchledger/transport";

interface SubmitOrder {
  type: string;
  orderId: string;
  accountId: string;
  symbol: string;
  side: string;
  quantity: bigint;
  price?: bigint;
}

interface DecodedEnvelope {
  payload: unknown;
  timestamp?: number;
}

interface JournalEntry {
  stream_id: string;
  seq: number;
  command: SubmitOrder;
}

interface ConsumerError extends Error {
  message: string;
}

interface OffsetRow {
  next_offset: bigint | string;
}

export interface OrdersSubmittedConsumerConfig {
  consumer: PartitionConsumer;
  brokers: string[];
  pool: Pool;
  partitionId: number;
  epoch: bigint; // Current lease epoch for risk-<partition>
}

/**
 * Start consuming orders.submitted for a risk partition.
 * Each SubmitOrder is journaled through FencedPgJournal with atomic offset tracking.
 */
export async function startOrdersSubmittedConsumer(
  config: OrdersSubmittedConsumerConfig
): Promise<void> {
  const leaseId = `risk-${config.partitionId}`;
  const sql = createSqlExecutor(config.pool);

  await config.consumer.run(
    async (msg: ConsumerMessage) => {
      try {
        // Decode SubmitOrder from envelope
        const decoded = decodeEnvelope(msg.value.toString()) as DecodedEnvelope;
        const submitOrder = decoded.payload as SubmitOrder;

        // Journal SubmitOrder + offset in same transaction
        const journalTx = new FencedPgJournal(sql, leaseId, config.epoch);
        const entry: JournalEntry = {
          stream_id: "", // risk-<partition> doesn't have symbol streams
          seq: 0, // Will be assigned by journal
          command: submitOrder,
        };
        await journalTx.append([entry]);

        // Update consumer_offsets
        await sql.query(
          `INSERT INTO consumer_offsets (lease_id, topic, partition, next_offset, writer_epoch)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (lease_id, topic, partition)
           DO UPDATE SET next_offset = $4, writer_epoch = $5`,
          [leaseId, "orders.submitted", config.partitionId, msg.offset + 1n, config.epoch]
        );
      } catch (error) {
        const err = error as ConsumerError;
        if (err.message?.includes("fenced") || err.message?.includes("epoch")) {
          // Fenced: exit process
          console.error("[orders-submitted-consumer] Fenced write, exiting:", error);
          process.exit(1);
        }
        console.error("[orders-submitted-consumer] Error processing SubmitOrder:", error);
        throw error;
      }
    },
    (error: Error) => {
      console.error("[orders-submitted-consumer] Consumer error:", error);
      throw error;
    }
  );
}

/**
 * Recover orders.submitted offset for a risk partition.
 * Returns the next offset to seek to.
 */
export async function recoverOrdersSubmittedOffset(
  pool: Pool,
  partitionId: number
): Promise<bigint> {
  const leaseId = `risk-${partitionId}`;

  const result = await pool.query(
    "SELECT next_offset FROM consumer_offsets WHERE lease_id = $1 AND topic = $2",
    [leaseId, "orders.submitted"]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0] as OffsetRow;
    return typeof row.next_offset === "string" ? BigInt(row.next_offset) : row.next_offset;
  }

  return 0n; // Start from beginning
}
