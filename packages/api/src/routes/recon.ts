/**
 * Reconciliation routes.
 */

import type { FastifyInstance } from "fastify";

export async function registerReconRoutes(app: FastifyInstance): Promise<void> {
  app.post("/recon/runs", async (req, reply) => {
    return reply.code(202).send({ runId: "" });
  });

  app.get("/recon/runs", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.get<{ Params: { id: string } }>("/recon/runs/:id", async (req, reply) => {
    return reply.code(200).send({});
  });

  app.get("/recon/breaks", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.get<{ Params: { id: string } }>("/recon/breaks/:id", async (req, reply) => {
    return reply.code(200).send({});
  });

  app.get<{ Params: { id: string } }>("/recon/breaks/:id/audit", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    "/recon/breaks/:id/status",
    async (req, reply) => {
      return reply.code(202).send({});
    }
  );

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    "/recon/breaks/:id/resolve",
    async (req, reply) => {
      return reply.code(202).send({});
    }
  );
}
