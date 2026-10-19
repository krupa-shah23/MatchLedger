/**
 * Account routes: balances, positions, pnl, reservations, ledger.
 */

import type { FastifyInstance } from "fastify";

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/accounts/:id/balances", async (req, reply) => {
    return reply.code(200).send({ accountId: "", total: "0", held: "0", available: "0" });
  });

  app.get<{ Params: { id: string } }>("/accounts/:id/positions", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.get<{ Params: { id: string } }>("/accounts/:id/pnl", async (req, reply) => {
    return reply.code(200).send({ positions: [] });
  });

  app.get<{ Params: { id: string } }>("/accounts/:id/reservations", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.get<{ Params: { id: string } }>("/accounts/:id/ledger", async (req, reply) => {
    return reply.code(200).send([]);
  });
}
