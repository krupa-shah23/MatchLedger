/**
 * Orders routes: submit, list, get, cancel, timeline.
 */

import type { FastifyInstance } from "fastify";

/**
 * Submit order durably.
 * Hand-written function: must resolve after risk journal append.
 * NOT IMPLEMENTED - stub stays until Prompt 3a.
 */
export async function submitOrderDurably(_payload: unknown): Promise<{ orderId: string; status: string }> {
  throw new Error("submitOrderDurably: NOT IMPLEMENTED - hand-write this function");
}

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>("/orders", async (req, reply) => {
    // Stub: validate, call submitOrderDurably, return 202
    return reply.code(202).send({ orderId: "", status: "RECEIVED" });
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (req, reply) => {
    // Stub: query orders_view, return order or 404
    return reply.code(404).send({ code: "not_found", title: "Not Found", status: 404, detail: "" });
  });

  app.get("/orders", async (req, reply) => {
    // Stub: query orders_view with filters, return paginated list
    return reply.code(200).send({ items: [], cursor: null });
  });

  app.delete<{ Params: { id: string } }>("/orders/:id", async (req, reply) => {
    // Stub: cancel order via runtime facade
    return reply.code(202).send({ orderId: "" });
  });

  app.get<{ Params: { id: string } }>("/orders/:id/events", async (req, reply) => {
    // Stub: query audit timeline
    return reply.code(200).send([]);
  });
}
