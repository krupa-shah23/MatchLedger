/**
 * Market data routes: instruments, book, trades, status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export interface MarketRoutesDeps {
  // Will be filled in when routes are registered
}

export async function registerMarketRoutes(app: FastifyInstance): Promise<void> {
  // GET /instruments - list all instruments
  app.get<{ Querystring: unknown }>(
    "/instruments",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement - read from instrument config
      return reply.status(200).send([]);
    }
  );

  // GET /instruments/{symbol} - get instrument details
  app.get<{ Params: { symbol: string } }>(
    "/instruments/:symbol",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send({});
    }
  );

  // GET /symbols/{symbol}/book - order book with seq
  app.get<{ Params: { symbol: string }; Querystring: { depth?: string } }>(
    "/symbols/:symbol/book",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // depth defaults to 10, seq is engine seq of last applied command
      return reply.status(200).send({ bid: [], ask: [], seq: 0 });
    }
  );

  // GET /trades - recent trades
  app.get<{ Querystring: { symbol?: string; limit?: string } }>(
    "/trades",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send([]);
    }
  );

  // GET /status - breaker status
  app.get<{ Querystring: unknown }>(
    "/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send([]);
    }
  );
}
