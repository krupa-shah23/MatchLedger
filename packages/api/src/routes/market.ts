/**
 * Market data routes: instruments, book, trades, status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getBook, getTrades, getBreakers } from "@matchledger/projections";
import type { SqlExecutor } from "@matchledger/projections";
import { formatMinor } from "@matchledger/common";

export interface MarketRoutesDeps {
  executor: SqlExecutor;
  instruments: Array<{ symbol: string; tick: string; lot: string }>;
}

export async function registerMarketRoutes(app: FastifyInstance, deps: MarketRoutesDeps): Promise<void> {
  // GET /instruments - list all instruments
  app.get<{ Querystring: unknown }>(
    "/instruments",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send(
        deps.instruments.map((i) => ({
          symbol: i.symbol,
          tick: i.tick,
          lot: i.lot,
        }))
      );
    }
  );

  // GET /instruments/{symbol} - get instrument details
  app.get<{ Params: { symbol: string } }>(
    "/instruments/:symbol",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const inst = deps.instruments.find((i) => i.symbol === params.symbol);

      if (!inst) {
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Instrument not found",
          instance: `/instruments/${params.symbol}`,
          requestId: request.id,
        });
      }

      return reply.code(200).send({
        symbol: inst.symbol,
        tick: inst.tick,
        lot: inst.lot,
      });
    }
  );

  // GET /symbols/{symbol}/book - order book with seq
  app.get<{ Params: { symbol: string }; Querystring: { depth?: string } }>(
    "/symbols/:symbol/book",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      const query = request.query as any;
      const book = await getBook(deps.executor, params.symbol);
      const bookData = book as any;

      return reply.code(200).send({
        symbol: params.symbol,
        bid: (bookData.bid || []).map((b: any) => ({
          price: formatMinor(BigInt(b.price), 2),
          quantity: formatMinor(BigInt(b.quantity), 0),
        })),
        ask: (bookData.ask || []).map((a: any) => ({
          price: formatMinor(BigInt(a.price), 2),
          quantity: formatMinor(BigInt(a.quantity), 0),
        })),
        seq: bookData.seq ?? 0,
      });
    }
  );

  // GET /trades - recent trades
  app.get<{ Querystring: { symbol?: string; limit?: string } }>(
    "/trades",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as any;
      const limit = Math.max(1, Math.min(parseInt(query.limit || "20"), 200));
      const symbol = query.symbol;

      const trades = await getTrades(deps.executor, symbol, limit);

      return reply.code(200).send(
        trades.map((t: any) => ({
          symbol: t.symbol,
          tradeId: t.trade_id,
          price: formatMinor(BigInt(t.price), 2),
          quantity: formatMinor(BigInt(t.quantity), 0),
          takerSide: t.taker_side,
          ts: t.ts,
        }))
      );
    }
  );

  // GET /status - breaker status
  app.get<{ Querystring: unknown }>(
    "/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const breakers = await getBreakers(deps.executor);

      return reply.code(200).send(
        breakers.map((b: any) => ({
          symbol: b.symbol,
          state: b.state,
          tripReason: b.trip_reason,
          incidentStartTs: b.incident_start_ts,
          stateSinceTs: b.state_since_ts,
          lastIgnored: b.detail_json?.lastIgnored,
        }))
      );
    }
  );
}
