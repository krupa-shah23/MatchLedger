/**
 * Accounts routes: balances, positions, P&L, reservations, ledger
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export interface AccountsRoutesDeps {
  // Will be filled in when routes are registered
}

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  // GET /accounts/{id}/balances - total, held, available
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/balances",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement - read from projections
      // Returns: { cash, held_cash, available }
      return reply.status(200).send({});
    }
  );

  // GET /accounts/{id}/positions - quantity, held_shares, cost_basis, realized_pnl
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/positions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send([]);
    }
  );

  // GET /accounts/{id}/pnl - P&L details
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/pnl",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send([]);
    }
  );

  // GET /accounts/{id}/reservations - placed, converted, released
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/reservations",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement
      return reply.status(200).send([]);
    }
  );

  // GET /accounts/{id}/ledger - debit/credit lines with date filter
  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    "/accounts/:id/ledger",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: implement - read from durable ledger_entries
      return reply.status(200).send([]);
    }
  );
}
