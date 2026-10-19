/**
 * Market data routes: instruments, book, trades, status.
 */

import type { FastifyInstance } from "fastify";

export async function registerMarketRoutes(app: FastifyInstance): Promise<void> {
  app.get("/instruments", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.get<{ Params: { symbol: string } }>("/instruments/:symbol", async (req, reply) => {
    return reply.code(200).send({ symbol: "", tick: "", lot: "", status: "OPEN" });
  });

  app.get<{ Params: { symbol: string } }>("/symbols/:symbol/book", async (req, reply) => {
    return reply.code(200).send({ symbol: "", bid: [], ask: [], seq: 0 });
  });

  app.get("/trades", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.get("/status", async (req, reply) => {
    return reply.code(200).send({});
  });
}
