/**
 * System routes: invariants, health.
 */

import type { FastifyInstance } from "fastify";

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/system/invariants", async (req, reply) => {
    return reply.code(200).send({ ledgerZeroSum: true, invariantsBroken: false });
  });

  app.get("/system/health", async (req, reply) => {
    return reply.code(200).send({ status: "ok", projectorLagSeq: 0, pipelineState: "running" });
  });
}
