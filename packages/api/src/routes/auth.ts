/**
 * Authentication routes: login, refresh, me.
 */

import type { FastifyInstance } from "fastify";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { username: string; password: string } }>("/auth/login", async (req, reply) => {
    // Stub: verify username/password, issue JWT
    return reply.code(200).send({ token: "", expiresIn: 900 });
  });

  app.post("/auth/refresh", async (req, reply) => {
    // Stub: verify current token, issue new one with same auth_time
    return reply.code(200).send({ token: "", expiresIn: 900 });
  });

  app.get("/me", async (req, reply) => {
    // Stub: return current user info from JWT
    return reply.code(200).send({ userId: "", username: "", role: "TRADER", accountIds: [] });
  });
}
