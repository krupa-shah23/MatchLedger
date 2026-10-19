/**
 * Authentication routes: login, refresh, me.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyPassword, getDummyHash } from "../auth/passwords.js";
import { signToken, verifyToken } from "../auth/tokens.js";
import { getUserByUsername, getUserById, getUserAccounts } from "../auth/users.js";
import type { SqlExecutor } from "../auth/users.js";
import type { Config } from "../config.js";
import { z } from "zod";

const LoginSchema = z.object({
  username: z.string().min(1, "Username required"),
  password: z.string().min(1, "Password required"),
});

export interface AuthRoutesDeps {
  executor: SqlExecutor;
  config: Config;
}

export async function registerAuthRoutes(app: FastifyInstance, deps: AuthRoutesDeps): Promise<void> {
  app.post<{ Body: unknown }>(
    "/auth/login",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = LoginSchema.parse(req.body);

        // Get user by username
        const user = await getUserByUsername(deps.executor, body.username);

        // Timing-safe comparison: if user not found, hash against dummy
        const hash = user?.password_hash || getDummyHash();
        const passwordMatch = await verifyPassword(body.password, hash);

        if (!user || !passwordMatch) {
          return reply.status(401).type("application/problem+json").send({
            type: "about:blank#unauthenticated",
            title: "Invalid credentials",
            status: 401,
            code: "unauthenticated",
            detail: "Invalid username or password",
            instance: "/auth/login",
            requestId: req.id,
          });
        }

        if (!user.active) {
          return reply.status(401).type("application/problem+json").send({
            type: "about:blank#unauthenticated",
            title: "User inactive",
            status: 401,
            code: "unauthenticated",
            detail: "User account is inactive",
            instance: "/auth/login",
            requestId: req.id,
          });
        }

        // Get accounts for this user
        const accounts = await getUserAccounts(deps.executor, user.user_id);
        const accountIds = accounts.map((a: any) => a.account_id);

        // Sign token with auth_time
        const authTime = Math.floor(Date.now() / 1000);
        const secret = new TextEncoder().encode(deps.config.JWT_SECRET);
        const token = await signToken({ secret, ttlSeconds: deps.config.JWT_TTL_SECONDS }, user.user_id, user.role, authTime);
        const expiresAt = new Date(Date.now() + deps.config.JWT_TTL_SECONDS * 1000);

        return reply.code(200).send({
          token,
          expiresAt: expiresAt.toISOString(),
          user: {
            userId: user.user_id,
            username: user.username,
            role: user.role,
            accountIds,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message || "Invalid request",
            instance: "/auth/login",
            requestId: req.id,
            errors: err.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          });
        }
        throw err;
      }
    }
  );

  app.post<{ Body: unknown }>(
    "/auth/refresh",
    async (req: FastifyRequest, reply: FastifyReply) => {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Missing token",
          status: 401,
          code: "unauthenticated",
          detail: "Authorization header required",
          instance: "/auth/refresh",
          requestId: req.id,
        });
      }

      const tokenString = authHeader.slice(7);

      try {
        const secret = new TextEncoder().encode(deps.config.JWT_SECRET);
        const token = await verifyToken({ secret, ttlSeconds: deps.config.JWT_TTL_SECONDS }, tokenString);

        // Check if session is too old (auth_time + SESSION_MAX_SECONDS)
        const authTime = token.auth_time || Math.floor(Date.now() / 1000);
        const now = Math.floor(Date.now() / 1000);
        const sessionAge = now - authTime;

        if (sessionAge > deps.config.SESSION_MAX_SECONDS) {
          return reply.status(401).type("application/problem+json").send({
            type: "about:blank#unauthenticated",
            title: "Session expired",
            status: 401,
            code: "unauthenticated",
            detail: "Session has exceeded maximum age",
            instance: "/auth/refresh",
            requestId: req.id,
          });
        }

        // Issue new token with SAME auth_time
        const newToken = await signToken({ secret, ttlSeconds: deps.config.JWT_TTL_SECONDS }, token.sub, token.role, authTime);
        const expiresAt = new Date(Date.now() + deps.config.JWT_TTL_SECONDS * 1000);

        return reply.code(200).send({
          token: newToken,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (err) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Invalid token",
          status: 401,
          code: "unauthenticated",
          detail: "Token is invalid or expired",
          instance: "/auth/refresh",
          requestId: req.id,
        });
      }
    }
  );

  app.get(
    "/me",
    async (req: FastifyRequest, reply: FastifyReply) => {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Missing token",
          status: 401,
          code: "unauthenticated",
          detail: "Authorization header required",
          instance: "/me",
          requestId: req.id,
        });
      }

      const tokenString = authHeader.slice(7);

      try {
        const secret = new TextEncoder().encode(deps.config.JWT_SECRET);
        const token = await verifyToken({ secret, ttlSeconds: deps.config.JWT_TTL_SECONDS }, tokenString);

        // Get user and accounts
        const user = await getUserById(deps.executor, token.sub);
        if (!user) {
          return reply.status(401).type("application/problem+json").send({
            type: "about:blank#unauthenticated",
            title: "User not found",
            status: 401,
            code: "unauthenticated",
            detail: "User no longer exists",
            instance: "/me",
            requestId: req.id,
          });
        }

        const accounts = await getUserAccounts(deps.executor, token.sub);
        const accountIds = accounts.map((a: any) => a.account_id);

        return reply.code(200).send({
          userId: user.user_id,
          username: user.username,
          role: user.role,
          accountIds,
        });
      } catch (err) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Invalid token",
          status: 401,
          code: "unauthenticated",
          detail: "Token is invalid or expired",
          instance: "/me",
          requestId: req.id,
        });
      }
    }
  );
}
