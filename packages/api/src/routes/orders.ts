/**
 * Orders routes: POST /orders, GET /orders/{id}, GET /orders, DELETE /orders/{id}
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiRole } from "@matchledger/common";

export interface OrderRoutesDeps {
  // Will be filled in when routes are registered
}

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  // POST /orders - submit an order
  app.post<{ Body: unknown }>(
    "/orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(202).send({ orderId: "", status: "RECEIVED" });
    }
  );

  // GET /orders/{id} - get order details
  app.get<{ Params: { id: string } }>(
    "/orders/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send({});
    }
  );

  // GET /orders - list orders
  app.get<{ Querystring: { accountId?: string; cursor?: string; limit?: string } }>(
    "/orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send({ orders: [], nextCursor: null });
    }
  );

  // DELETE /orders/{id} - cancel an order
  app.delete<{ Params: { id: string } }>(
    "/orders/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(202).send({});
    }
  );
}
