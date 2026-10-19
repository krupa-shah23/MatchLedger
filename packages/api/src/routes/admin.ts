/**
 * Admin routes: users, accounts, deposit, demo reset.
 */

import type { FastifyInstance } from "fastify";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/users", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.post<{ Body: { username: string; password: string; role: string } }>(
    "/admin/users",
    async (req, reply) => {
      return reply.code(201).send({ userId: "" });
    }
  );

  app.get("/admin/accounts", async (req, reply) => {
    return reply.code(200).send([]);
  });

  app.post<{ Body: { userId: string } }>("/admin/accounts", async (req, reply) => {
    return reply.code(201).send({ accountId: "" });
  });

  app.post<{ Params: { id: string }; Body: { requestId: string; asset: string; amount: string } }>(
    "/admin/accounts/:id/deposit",
    async (req, reply) => {
      return reply.code(202).send({});
    }
  );
}
