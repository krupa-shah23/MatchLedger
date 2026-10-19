/**
 * submitOrderDurably: the durability sequence for POST /orders
 * Hand-written implementation with single-flight and register-before-submit ordering
 */

import { SingleFlight } from "./single-flight.js";
import { createHash } from "node:crypto";

export interface SqlExecutor {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface RuntimeFacade {
  hasSubmitCommand(orderId: string): Promise<boolean>;
  submitOrder(cmd: unknown): Promise<{ kind: "JOURNALED" | "FULL" }>;
}

interface OrderRequest {
  account_id: string;
  client_order_id: string;
  payload_hash: string;
  order_id: string;
}

const singleFlight = new SingleFlight<{ orderId: string; journaled: boolean }>();

/**
 * Register order in order_requests table and submit to runtime if not already journaled.
 * Returns the orderId and whether this invocation journaled the command.
 * Single-flight ensures concurrent identical requests share one execution.
 */
export async function submitOrderDurably(
  executor: SqlExecutor,
  facade: RuntimeFacade,
  accountId: string,
  clientOrderId: string,
  payloadHash: string,
  submitCommand: unknown,
  orderId: string
): Promise<{ orderId: string; journaled: boolean }> {
  const key = `${accountId}:${clientOrderId}`;

  return await singleFlight.run(key, async () => {
    // Step 1: Register in order_requests (idempotency key)
    const result = await executor.query(
      `INSERT INTO order_requests (account_id, client_order_id, payload_hash, order_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, client_order_id) DO UPDATE SET payload_hash = $3
       RETURNING order_id, payload_hash;`,
      [accountId, clientOrderId, payloadHash, orderId]
    );

    const stored = result.rows[0] as OrderRequest | undefined;
    if (!stored) {
      throw new Error("Failed to register order");
    }

    const storedOrderId = stored.order_id;

    // Check if payload matches (conflict if different)
    if (stored.payload_hash !== payloadHash) {
      throw new Error("CONFLICT_DIFFERENT_PAYLOAD");
    }

    // Step 2: Check if command already journaled
    const alreadyJournaled = await facade.hasSubmitCommand(storedOrderId);
    if (alreadyJournaled) {
      return { orderId: storedOrderId, journaled: false };
    }

    // Step 3: Submit to runtime (awaits journal append)
    try {
      await facade.submitOrder(submitCommand);
      return { orderId: storedOrderId, journaled: true };
    } catch (err) {
      // Journal append failed: single-flight entry removed on error
      throw err;
    }
  });
}
