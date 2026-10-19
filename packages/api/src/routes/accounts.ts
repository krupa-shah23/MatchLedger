/**
 * Accounts routes: balances, positions, P&L, reservations, ledger
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getBalances, getPositions, getPnl, getReservations, getLedger } from "@matchledger/projections";
import type { SqlExecutor } from "@matchledger/projections";
import { formatMinor } from "@matchledger/common";

export interface AccountsRoutesDeps {
  executor: SqlExecutor;
}

export async function registerAccountRoutes(app: FastifyInstance, deps: AccountsRoutesDeps): Promise<void> {
  // GET /accounts/{id}/balances - total, held, available
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/balances",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const balances = await getBalances(deps.executor, params.id);

      if (!balances) {
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Account not found",
          instance: `/accounts/${params.id}/balances`,
          requestId: request.id,
        });
      }

      const cash = BigInt((balances as any).cash || 0);
      const heldCash = BigInt((balances as any).held_cash || 0);
      return reply.code(200).send({
        accountId: params.id,
        cash: formatMinor(cash, 2),
        heldCash: formatMinor(heldCash, 2),
        available: formatMinor(cash - heldCash, 2),
      });
    }
  );

  // GET /accounts/{id}/positions
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/positions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const positions = await getPositions(deps.executor, params.id);
      return reply.code(200).send(
        positions.map((p: any) => ({
          symbol: p.symbol,
          quantity: formatMinor(BigInt(p.quantity || 0), 0),
          heldShares: formatMinor(BigInt(p.held_shares || 0), 0),
          costBasis: formatMinor(BigInt(p.cost_basis || 0), 2),
          realizedPnl: formatMinor(BigInt(p.realized_pnl || 0), 2),
        }))
      );
    }
  );

  // GET /accounts/{id}/pnl
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/pnl",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const pnl = await getPnl(deps.executor, params.id);
      return reply.code(200).send(
        pnl.map((p: any) => ({
          symbol: p.symbol,
          quantity: formatMinor(BigInt(p.quantity || 0), 0),
          costBasis: formatMinor(BigInt(p.cost_basis || 0), 2),
          realizedPnl: formatMinor(BigInt(p.realized_pnl || 0), 2),
        }))
      );
    }
  );

  // GET /accounts/{id}/reservations
  app.get<{ Params: { id: string } }>(
    "/accounts/:id/reservations",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const reservations = await getReservations(deps.executor, params.id);
      return reply.code(200).send(
        reservations.map((r: any) => ({
          orderId: r.order_id,
          symbol: r.symbol,
          asset: r.asset,
          amountTotal: formatMinor(BigInt(r.amount_total || 0), 2),
          amountRemaining: formatMinor(BigInt(r.amount_remaining || 0), 2),
          status: r.status,
        }))
      );
    }
  );

  // GET /accounts/{id}/ledger
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/accounts/:id/ledger",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const query = request.query as any;
      const limit = Math.min(Math.max(parseInt(query.limit || "100"), 1), 1000);
      const ledger = await getLedger(deps.executor, params.id, limit);
      return reply.code(200).send(
        ledger.map((l: any) => ({
          entryId: l.entry_id,
          asset: l.asset,
          debit: l.debit ? formatMinor(BigInt(l.debit), 2) : null,
          credit: l.credit ? formatMinor(BigInt(l.credit), 2) : null,
          balance: formatMinor(BigInt(l.balance || 0), 2),
          ts: l.ts,
        }))
      );
    }
  );
}
