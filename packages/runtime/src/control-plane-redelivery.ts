/**
 * Control-plane redelivery for Kafka mode (Week 10, task 5.4).
 * During recovery (step 5), republish OrderAccepted for PENDING_ACK orders
 * with header redelivered=true.
 * Shard host will then look up engine journal for existing PlaceOrder and skip if present.
 */

import { TransactionalProducer, encodeEnvelope } from "@matchledger/transport";
import { partitionOf } from "@matchledger/common";
import type { SqlExecutor } from "@matchledger/journal";

export interface ControlPlaneRedeliveryConfig {
  producer: TransactionalProducer;
  brokers: string[];
  sql: SqlExecutor;
  riskPartitions: number;
  shardPartitions: number;
}

/**
 * Republish OrderAccepted for PENDING_ACK orders with redelivered=true.
 * This is step 5 of recoverPipeline, called during control-plane recovery.
 */
export async function republishPendingOrders(config: ControlPlaneRedeliveryConfig): Promise<void> {
  // Query order_requests for PENDING_ACK orders (published_at is set, but no trade yet)
  const pendingOrders = await config.sql.query(
    `SELECT orderId, accountId, payload_json, published_at
     FROM order_requests
     WHERE published_at IS NOT NULL
     AND status = 'PENDING_ACK'`,
    []
  );

  if (pendingOrders.rows.length === 0) {
    return; // No pending orders to redeliver
  }

  // Republish each order as OrderAccepted with redelivered=true
  const messages = (pendingOrders.rows as any[]).map((row) => {
    const payload = row.payload_json;
    const symbol = payload.symbol || "";

    // Messages go to orders.accepted topic, partitioned by symbol
    const partition = partitionOf(symbol, config.shardPartitions);

    const orderAccepted = {
      type: "OrderAccepted",
      orderId: row.orderId,
      accountId: row.accountId,
      ...payload,
    };

    return {
      key: symbol,
      value: encodeEnvelope({
        schemaVersion: 1,
        msgId: `redelivered:${row.orderId}:${Date.now()}`,
        type: "OrderAccepted",
        payload: orderAccepted,
      }),
      partition,
      headers: {
        redelivered: "true", // Mark as redelivered
      },
    };
  });

  // Send in batches (avoid too many messages in one transaction)
  const batchSize = 100;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    await config.producer.sendBatch("orders.accepted", batch);
  }
}

/**
 * Look up engine journal for existing PlaceOrder with the given orderId.
 * Used by shard host when processing redelivered OrderAccepted.
 * If found, the shard skips the order and advances the offset.
 */
export async function hasPlaceOrderInJournal(
  sql: SqlExecutor,
  symbol: string,
  orderId: string
): Promise<boolean> {
  const result = await sql.query(
    `SELECT 1 FROM journal
     WHERE stream_id = $1
     AND record_type = 'COMMAND'
     AND payload_json->>'orderId' = $2
     LIMIT 1`,
    [symbol, orderId]
  );

  return result.rows.length > 0;
}
