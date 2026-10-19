/**
 * submitOrderDurably facade (Phase B, task 6.2).
 * Week 9 (inproc): journals through risk partition
 * Week 10 (kafka): publishes to orders.submitted, sets published_at, then journals
 *
 * Contract: "202 means durably received"
 * inproc: true when journaled through risk partition
 * kafka: true when published to orders.submitted and published_at is set
 */

import type { SqlExecutor } from "@matchledger/journal";

export interface SubmitOrderConfig {
  transport: "inproc" | "kafka";
  sql: SqlExecutor;
  gatewayPublisher?: any; // GatewayPublisher (only for kafka mode)
}

export type SubmitOrderResult =
  | { kind: "JOURNALED"; riskSeq: number }
  | { kind: "FULL" }
  | { kind: "FAILED"; error: string };

/**
 * submitOrderDurably: Hand-written implementation with mode dispatch.
 *
 * INPROC MODE (Week 9):
 * - Single-flight via order_requests register
 * - Journal SubmitOrder through risk partition (bounded submit entry)
 * - Return 202 when journaled
 *
 * KAFKA MODE (Phase B):
 * - Single-flight via order_requests register (same as inproc)
 * - Publish SubmitOrder to orders.submitted (idempotent producer, acks=all)
 * - On publish success: set published_at in order_requests
 * - Return 202 when published_at is set
 * - On publish failure: return 503 Retry-After (retry is safe due to single-flight)
 *
 * Durability point:
 * - inproc: journal write
 * - kafka: published_at set (which happens after Kafka ack)
 *
 * Difference: kafka mode adds one more step (publish) before returning 202
 */
export async function submitOrderDurably(
  orderId: string,
  accountId: string,
  clientOrderId: string,
  payload: unknown,
  config: SubmitOrderConfig
): Promise<SubmitOrderResult> {
  // Step 1: Single-flight via order_requests (same for both modes)
  const registerResult = await registerOrder(config.sql, accountId, clientOrderId, orderId, payload);

  if (registerResult.kind === "CONFLICT") {
    return { kind: "FAILED", error: "Payload mismatch" }; // 409
  }

  if (registerResult.kind === "DUPLICATE") {
    // Already registered and processed; check if published_at is set
    const existingOrder = await getOrderRequest(config.sql, orderId);
    if (existingOrder && existingOrder.published_at) {
      // Already published; return the original orderId
      return { kind: "JOURNALED", riskSeq: existingOrder.risk_seq ?? 0 };
    }
    // Not published yet; treat as retry (fall through to publish)
  }

  if (config.transport === "inproc") {
    // INPROC MODE (unchanged from Week 9)
    // Journal through risk partition
    const journalResult = await journalSubmitOrder(config.sql, orderId, accountId, payload);

    if (journalResult.kind === "FULL") {
      return { kind: "FULL" };
    }

    return { kind: "JOURNALED", riskSeq: journalResult.seq ?? 0 };
  } else if (config.transport === "kafka") {
    // KAFKA MODE (Phase B)
    if (!config.gatewayPublisher) {
      return { kind: "FAILED", error: "Gateway publisher not configured" };
    }

    // Step 2: Publish to orders.submitted
    const publishResult = await config.gatewayPublisher.publishSubmitOrder(
      orderId,
      accountId,
      clientOrderId,
      payload
    );

    if (!publishResult.published) {
      // Publish failed; return 503
      return { kind: "FAILED", error: publishResult.error };
    }

    // Step 3: Set published_at (after Kafka ack)
    // This is the durability point; now the order is visible in GET /orders/{id}
    await setPublishedAt(config.sql, orderId);

    return { kind: "JOURNALED", riskSeq: 0 };
  } else {
    return { kind: "FAILED", error: `Unknown transport: ${config.transport}` };
  }
}

// Helper functions (stubs - actual implementation would use proper queries)

async function registerOrder(
  sql: SqlExecutor,
  accountId: string,
  clientOrderId: string,
  orderId: string,
  payload: unknown
): Promise<{ kind: "CREATED" | "DUPLICATE" | "CONFLICT" }> {
  // INSERT into order_requests OR return CONFLICT/DUPLICATE
  // Single-flight: unique(accountId, clientOrderId)
  return { kind: "CREATED" };
}

async function journalSubmitOrder(
  sql: SqlExecutor,
  orderId: string,
  accountId: string,
  payload: unknown
): Promise<{ kind: "FULL" | "JOURNALED"; seq?: number }> {
  // Journal through bounded submit entry of risk partition
  // Return risk seq or FULL if queue is full
  return { kind: "JOURNALED", seq: 1 };
}

async function setPublishedAt(sql: SqlExecutor, orderId: string): Promise<void> {
  // UPDATE order_requests SET published_at = now() WHERE orderId = ?
  // This makes the order visible in GET /orders/{id} via synthesized RECEIVED status
}

async function getOrderRequest(
  sql: SqlExecutor,
  orderId: string
): Promise<{ published_at?: Date; risk_seq?: number } | null> {
  // SELECT published_at, risk_seq FROM order_requests WHERE orderId = ?
  return null;
}
