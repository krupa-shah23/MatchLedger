/**
 * Orders routes: POST /orders, GET /orders/{id}, GET /orders, DELETE /orders/{id}, GET /orders/{id}/events
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { createHash } from "node:crypto";
import { submitOrderDurably } from "../orders/submit.js";
import type { SqlExecutor } from "../orders/submit.js";
import type { RuntimeFacade } from "../orders/submit.js";
import { getOrder, listOrders, getOrderTimeline, deriveOrderStatus } from "@matchledger/projections";
import { parseDecimalToMinor, formatMinor } from "@matchledger/common";

const PlaceOrderSchema = z.object({
  clientOrderId: z.string().min(1).max(64),
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET"]),
  timeInForce: z.enum(["GTC", "IOC"]),
  quantity: z.union([z.string(), z.number()]),
  price: z.union([z.string(), z.number()]).optional().nullable(),
}).strict().refine(
  (data) => {
    // MARKET orders must have IOC timeInForce
    if (data.type === "MARKET" && data.timeInForce !== "IOC") {
      return false;
    }
    return true;
  },
  { message: "MARKET orders must have timeInForce=IOC", path: ["type"] }
).refine(
  (data) => {
    // MARKET orders must not have price
    if (data.type === "MARKET" && data.price !== null && data.price !== undefined) {
      return false;
    }
    return true;
  },
  { message: "MARKET orders cannot have a price", path: ["price"] }
).refine(
  (data) => {
    // LIMIT orders must have price
    if (data.type === "LIMIT" && (data.price === null || data.price === undefined)) {
      return false;
    }
    return true;
  },
  { message: "LIMIT orders must have a price", path: ["price"] }
);

export interface OrderRoutesDeps {
  executor: SqlExecutor;
  facade: RuntimeFacade;
}

export async function registerOrderRoutes(app: FastifyInstance, deps: OrderRoutesDeps): Promise<void> {
  // POST /orders - submit an order
  app.post<{ Body: unknown }>(
    "/orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check auth
        const user = (request as any).user;
        if (!user || user.role !== "TRADER") {
          return reply.status(403).type("application/problem+json").send({
            type: "about:blank#forbidden",
            title: "Forbidden",
            status: 403,
            code: "forbidden",
            detail: "Only traders can submit orders",
            instance: "/orders",
            requestId: request.id,
          });
        }

        // Get first account (or require accountId param for multi-account traders)
        const accountId = user.accountIds[0];
        if (!accountId) {
          return reply.status(403).type("application/problem+json").send({
            type: "about:blank#forbidden",
            title: "Forbidden",
            status: 403,
            code: "forbidden",
            detail: "No accounts available",
            instance: "/orders",
            requestId: request.id,
          });
        }

        const body = PlaceOrderSchema.parse(request.body);

        // Generate order ID
        const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Compute payload hash for idempotency
        const payload = JSON.stringify(body);
        const payloadHash = createHash("sha256").update(payload).digest("hex");

        // Call submitOrderDurably - awaits journal append before returning 202
        const result = await submitOrderDurably(
          deps.executor,
          deps.facade,
          accountId,
          body.clientOrderId,
          payloadHash,
          {
            type: "SubmitOrder",
            orderId,
            accountId,
            symbol: body.symbol,
            side: body.side,
            kind: body.type,
            timeInForce: body.timeInForce,
            quantity: typeof body.quantity === "string" ? BigInt(parseDecimalToMinor(body.quantity, 0)) : BigInt(body.quantity),
            price: body.price ? (typeof body.price === "string" ? BigInt(parseDecimalToMinor(body.price, 2)) : BigInt(body.price)) : null,
          },
          orderId
        );

        return reply.status(202).send({
          orderId: result.orderId,
          status: "RECEIVED",
        });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message || "Invalid request",
            instance: "/orders",
            requestId: request.id,
            errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          });
        }
        if (err.message === "CONFLICT_DIFFERENT_PAYLOAD") {
          return reply.status(409).type("application/problem+json").send({
            type: "about:blank#conflict",
            title: "Conflict",
            status: 409,
            code: "conflict",
            detail: "Same clientOrderId with different payload",
            instance: "/orders",
            requestId: request.id,
          });
        }
        throw err;
      }
    }
  );

  // GET /orders/{id} - get order details
  app.get<{ Params: { id: string } }>(
    "/orders/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check auth
      const user = (request as any).user;
      const params = request.params as any;
      if (!user) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Unauthenticated",
          status: 401,
          code: "unauthenticated",
          detail: "Authentication required",
          instance: `/orders/${params.id}`,
          requestId: request.id,
        });
      }

      const order = await getOrder(deps.executor, params.id as any);

      if (!order) {
        // Try to synthesize RECEIVED from order_requests if command was journaled
        // For now, return 404
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Order not found",
          instance: `/orders/${params.id}`,
          requestId: request.id,
        });
      }

      // Check ownership (for TRADER role)
      if (user.role === "TRADER" && !user.accountIds.includes(order.account_id as string)) {
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Order not found",
          instance: `/orders/${params.id}`,
          requestId: request.id,
        });
      }

      // Derive status from facts
      const status = deriveOrderStatus({
        quantity: BigInt(order.quantity as any),
        accepted: order.accepted as boolean,
        rested: order.rested as boolean,
        filledQty: BigInt(order.filled_qty as any),
        terminal: order.terminal as any,
        cancelRequested: order.cancel_requested as boolean,
        hasCommand: true,
      });

      return reply.code(200).send({
        orderId: order.order_id,
        clientOrderId: order.client_order_id,
        accountId: order.account_id,
        symbol: order.symbol,
        side: order.side,
        type: order.order_type,
        timeInForce: order.time_in_force,
        quantity: formatMinor(BigInt(order.quantity as any), 0),
        price: order.price ? formatMinor(BigInt(order.price as any), 2) : null,
        effectivePrice: order.effective_price ? formatMinor(BigInt(order.effective_price as any), 2) : null,
        filledQty: formatMinor(BigInt(order.filled_qty as any), 0),
        status,
        cancelRequested: order.cancel_requested,
        terminal: order.terminal,
        terminalReason: order.terminal_reason,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      });
    }
  );

  // GET /orders - list orders
  app.get<{ Querystring: { accountId?: string; cursor?: string; limit?: string } }>(
    "/orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check auth
      const user = (request as any).user;
      const query = request.query as any;
      if (!user) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Unauthenticated",
          status: 401,
          code: "unauthenticated",
          detail: "Authentication required",
          instance: "/orders",
          requestId: request.id,
        });
      }

      const limit = Math.min(Math.max(parseInt(query.limit || "50"), 1), 200);
      const cursor = query.cursor;

      let accountId: string;

      if (user.role === "TRADER") {
        // TRADER can only see own accounts
        accountId = user.accountIds[0];
        if (!accountId) {
          return reply.status(403).type("application/problem+json").send({
            type: "about:blank#forbidden",
            title: "Forbidden",
            status: 403,
            code: "forbidden",
            detail: "No accounts available",
            instance: "/orders",
            requestId: request.id,
          });
        }
      } else {
        // RISK/OPS/ADMIN require accountId query param
        accountId = query.accountId;
        if (!accountId) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: "accountId is required",
            instance: "/orders",
            requestId: request.id,
          });
        }
      }

      const result = await listOrders(deps.executor, accountId, limit, cursor);

      return reply.code(200).send({
        orders: result.orders.map((o: any) => {
          const status = deriveOrderStatus({
            quantity: BigInt(o.quantity),
            accepted: o.accepted,
            rested: o.rested,
            filledQty: BigInt(o.filled_qty),
            terminal: o.terminal,
            cancelRequested: o.cancel_requested,
            hasCommand: true,
          });

          return {
            orderId: o.order_id,
            clientOrderId: o.client_order_id,
            accountId: o.account_id,
            symbol: o.symbol,
            side: o.side,
            type: o.order_type,
            timeInForce: o.time_in_force,
            quantity: formatMinor(BigInt(o.quantity), 0),
            price: o.price ? formatMinor(BigInt(o.price), 2) : null,
            filledQty: formatMinor(BigInt(o.filled_qty), 0),
            status,
            createdAt: o.created_at,
          };
        }),
        nextCursor: result.nextCursor,
      });
    }
  );

  // DELETE /orders/{id} - cancel an order
  app.delete<{ Params: { id: string } }>(
    "/orders/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check auth
      const user = (request as any).user;
      const params = request.params as any;
      if (!user || user.role !== "TRADER") {
        return reply.status(403).type("application/problem+json").send({
          type: "about:blank#forbidden",
          title: "Forbidden",
          status: 403,
          code: "forbidden",
          detail: "Only traders can cancel orders",
          instance: `/orders/${params.id}`,
          requestId: request.id,
        });
      }

      const order = await getOrder(deps.executor, params.id as any);

      if (!order) {
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Order not found",
          instance: `/orders/${params.id}`,
          requestId: request.id,
        });
      }

      // Check ownership
      if (!user.accountIds.includes(order.account_id as string)) {
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Order not found",
          instance: `/orders/${params.id}`,
          requestId: request.id,
        });
      }

      // Check if terminal
      if (order.terminal) {
        return reply.status(409).type("application/problem+json").send({
          type: "about:blank#conflict",
          title: "Conflict",
          status: 409,
          code: "conflict",
          detail: `Order is ${order.terminal} and cannot be cancelled`,
          instance: `/orders/${params.id}`,
          requestId: request.id,
        });
      }

      // Call facade to cancel - enqueues CancelOrder to shard, journaled later
      await deps.facade.cancelOrder(order.symbol as string, params.id);

      return reply.status(202).send({ orderId: params.id });
    }
  );

  // GET /orders/{id}/events - audit timeline
  app.get<{ Params: { id: string } }>(
    "/orders/:id/events",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const timeline = await getOrderTimeline(deps.executor, params.id);

      if (timeline.length === 0) {
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Order not found",
          instance: `/orders/${params.id}/events`,
          requestId: request.id,
        });
      }

      return reply.code(200).send(
        timeline.map((evt: any) => ({
          ts: evt.ts,
          stageRank: evt.stage_rank,
          seq: evt.seq,
          idx: evt.idx,
          source: evt.source,
          payload: evt.payload ? JSON.stringify(evt.payload) : "{}",
        }))
      );
    }
  );
}
