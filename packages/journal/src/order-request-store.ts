/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import type { Pool } from "pg";

export type OrderRequestResult = "CREATED" | "DUPLICATE" | "CONFLICT";

export class OrderRequestStore {
  constructor(private readonly pool: Pool) {}

  async register(
    accountId: string,
    clientOrderId: string,
    orderId: string,
    payloadJson: unknown,
  ): Promise<{ result: OrderRequestResult; orderId: string }> {
    const payloadHash = createHash("sha256").update(JSON.stringify(payloadJson)).digest("hex");

    try {
      await this.pool.query(
        "INSERT INTO order_requests (account_id, client_order_id, order_id, payload_hash) VALUES ($1, $2, $3, $4)",
        [accountId, clientOrderId, orderId, payloadHash],
      );
      return { result: "CREATED", orderId };
    } catch (error: any) {
      if (error.code === "23505") {
        const existing = await this.pool.query(
          "SELECT order_id, payload_hash FROM order_requests WHERE account_id = $1 AND client_order_id = $2",
          [accountId, clientOrderId],
        );
        if (existing.rows.length > 0) {
          const row = existing.rows[0] as any;
          if (row.payload_hash === payloadHash) {
            return { result: "DUPLICATE", orderId: row.order_id };
          } else {
            return { result: "CONFLICT", orderId: row.order_id };
          }
        }
      }
      throw error;
    }
  }
}
