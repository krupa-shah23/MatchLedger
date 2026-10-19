/**
 * Risk routes: rejections, breakers, halt, resume.
 */

import type { FastifyInstance } from "fastify";

export async function registerRiskRoutes(app: FastifyInstance): Promise<void> {
  app.get("/risk/rejections", async (req, reply) => {
    return reply.code(200).send({ items: [], cursor: null });
  });

  app.get("/risk/breakers", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.post<{ Params: { symbol: string }; Body: { reason: string } }>(
    "/risk/symbols/:symbol/halt",
    async (req, reply) => {
      return reply.code(202).send({ symbol: "" });
    }
  );

  app.post<{ Params: { symbol: string } }>(
    "/risk/symbols/:symbol/resume",
    async (req, reply) => {
      return reply.code(202).send({ symbol: "" });
    }
  );
}
