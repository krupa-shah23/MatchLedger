/**
 * Risk routes: halt/resume, rejections feed, breakers status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getRejections, getBreakers } from "@matchledger/projections";
import type { SqlExecutor, RuntimeFacade } from "@matchledger/projections";
import { formatMinor } from "@matchledger/common";

const HaltSchema = z.object({
  reason: z.string().min(1, "Reason required"),
});

const ResumeSchema = z.object({
  reason: z.string().optional(),
});

export interface RiskRoutesDeps {
  executor: SqlExecutor;
  facade: RuntimeFacade;
}

export async function registerRiskRoutes(app: FastifyInstance, deps: RiskRoutesDeps): Promise<void> {
  // POST /risk/symbols/{symbol}/halt - halt trading on a symbol
  app.post<{ Params: { symbol: string }; Body: unknown }>(
    "/risk/symbols/:symbol/halt",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      try {
        const body = HaltSchema.parse(request.body);
        await deps.facade.haltSymbol(params.symbol, body.reason);
        return reply.status(202).send({ symbol: params.symbol });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message,
            instance: `/risk/symbols/${params.symbol}/halt`,
            requestId: request.id,
          });
        }
        throw err;
      }
    }
  );

  // POST /risk/symbols/{symbol}/resume - resume trading on a symbol
  app.post<{ Params: { symbol: string }; Body: unknown }>(
    "/risk/symbols/:symbol/resume",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      try {
        const body = ResumeSchema.parse(request.body);
        await deps.facade.resumeSymbol(params.symbol, body.reason);
        return reply.status(202).send({ symbol: params.symbol });
      } catch (err) {
        throw err;
      }
    }
  );

  // GET /risk/rejections - rejection feed with filters and pagination
  app.get<{ Querystring: { reason?: string; accountId?: string; symbol?: string; from?: string; to?: string; limit?: string } }>(
    "/risk/rejections",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as any;
      const limit = Math.max(1, Math.min(parseInt(query.limit || "50"), 200));
      const rejections = await getRejections(deps.executor, limit);

      return reply.code(200).send(
        rejections.map((r: any) => ({
          id: r.id,
          source: r.source,
          orderId: r.order_id,
          accountId: r.account_id,
          symbol: r.symbol,
          reason: r.reason,
          required: r.required ? formatMinor(BigInt(r.required), 2) : null,
          snapshot: r.snapshot_json ? JSON.parse(r.snapshot_json) : null,
          ts: r.ts,
        }))
      );
    }
  );

  // GET /risk/breakers - breaker status for all symbols
  app.get<{ Querystring: unknown }>(
    "/risk/breakers",
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
