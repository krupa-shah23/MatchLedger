/**
 * System routes: invariants, health
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SqlExecutor } from "@matchledger/projections";
import type { RuntimeFacade } from "../orders/submit.js";

export interface SystemRoutesDeps {
  executor: SqlExecutor;
  facade: RuntimeFacade;
}

export async function registerSystemRoutes(app: FastifyInstance, deps: SystemRoutesDeps): Promise<void> {
  // GET /system/invariants - check system invariants
  app.get<{ Querystring: unknown }>(
    "/system/invariants",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: verify ledger zero-sum per asset
        // TODO: verify positions zero-sum per symbol
        // TODO: verify no negative available balance
        // TODO: compare projections with risk.riskView() for all accounts
        const valid = true;

        return reply.code(200).send({
          valid,
          ledgerZeroSum: true,
          positionsZeroSum: true,
          noNegativeAvailable: true,
          projectionsEqualRisk: true,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Invariant check failed",
          status: 500,
          code: "internal_error",
          detail: "System invariants check failed",
          instance: "/system/invariants",
          requestId: request.id,
        });
      }
    }
  );

  // GET /system/health - health status
  app.get<{ Querystring: unknown }>(
    "/system/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: calculate projector lag: max(journal seq) - checkpoint
        // TODO: get pipeline state from runtime
        const projectorLagSeq = 0;
        const pipelineState = "running";

        return reply.code(200).send({
          status: "healthy",
          projectorLagSeq,
          pipelineState,
          ts: new Date().toISOString(),
        });
      } catch (err) {
        return reply.code(503).type("application/problem+json").send({
          type: "about:blank#service_unavailable",
          title: "Service unavailable",
          status: 503,
          code: "service_unavailable",
          detail: "Health check failed",
          instance: "/system/health",
          requestId: request.id,
        });
      }
    }
  );
}
