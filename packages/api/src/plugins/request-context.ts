/**
 * Request context middleware: request ID, JWT verification, RBAC, ownership checks
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../auth/tokens.js";
import { getUserAccounts } from "../auth/users.js";
import type { Config } from "../config.js";
import type { SqlExecutor } from "@matchledger/projections";

export interface RequestContext {
  requestId: string;
  userId?: string;
  role?: string;
  accountIds: string[];
  authTime?: number;
}

export async function registerRequestContextPlugin(
  app: FastifyInstance,
  config: Config,
  executor: SqlExecutor
): Promise<void> {
  // Request ID hook
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Accept client-provided request ID if safe (alphanumeric + dashes, max 64 chars)
    const clientId = request.headers["x-request-id"];
    let requestId = "req_" + Math.random().toString(36).slice(2, 10);

    if (clientId && typeof clientId === "string" && /^[a-zA-Z0-9\-]{1,64}$/.test(clientId)) {
      requestId = clientId;
    }

    request.id = requestId;
    reply.header("X-Request-Id", requestId);
  });

  // JWT verification hook (except auth routes)
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth routes
    if (request.url.startsWith("/auth/login") || request.url.startsWith("/auth/refresh")) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Allow some public routes, deny others
      if (!isPublicRoute(request.url)) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Missing token",
          status: 401,
          code: "unauthenticated",
          detail: "Authorization header required",
          instance: request.url,
          requestId: request.id,
        });
      }
      return;
    }

    const tokenString = authHeader.slice(7);

    try {
      const secret = new TextEncoder().encode(config.JWT_SECRET);
      const token = await verifyToken({ secret, ttlSeconds: config.JWT_TTL_SECONDS }, tokenString);

      // Check session age
      const authTime = token.auth_time || Math.floor(Date.now() / 1000);
      const now = Math.floor(Date.now() / 1000);
      if (now - authTime > config.SESSION_MAX_SECONDS) {
        return reply.status(401).type("application/problem+json").send({
          type: "about:blank#unauthenticated",
          title: "Session expired",
          status: 401,
          code: "unauthenticated",
          detail: "Session has exceeded maximum age",
          instance: request.url,
          requestId: request.id,
        });
      }

      // Get user's accounts
      const accounts = await getUserAccounts(executor, token.sub);
      const accountIds = accounts.map((a: any) => a.account_id);

      // Attach to request
      (request as any).user = {
        userId: token.sub,
        role: token.role,
        accountIds,
        authTime,
      };
    } catch (err) {
      return reply.status(401).type("application/problem+json").send({
        type: "about:blank#unauthenticated",
        title: "Invalid token",
        status: 401,
        code: "unauthenticated",
        detail: "Token is invalid or expired",
        instance: request.url,
        requestId: request.id,
      });
    }
  });
}

function isPublicRoute(url: string): boolean {
  // Routes that don't require auth
  const publicRoutes = ["/auth/login", "/auth/refresh"];
  return publicRoutes.some((route) => url.startsWith(route));
}

/**
 * RBAC guard: check if user has role for endpoint
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).type("application/problem+json").send({
        type: "about:blank#forbidden",
        title: "Forbidden",
        status: 403,
        code: "forbidden",
        detail: "You do not have permission to access this resource",
        instance: request.url,
        requestId: request.id,
      });
    }
  };
}

/**
 * Ownership guard: check if user owns the account
 */
export function requireOwnership(accountIdParam: string = "accountId") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).type("application/problem+json").send({
        type: "about:blank#unauthenticated",
        title: "Missing token",
        status: 401,
        code: "unauthenticated",
        detail: "Authentication required",
        instance: request.url,
        requestId: request.id,
      });
    }

    // For TRADER role, check ownership of account
    // For RISK/OPS/ADMIN, require accountId query/param
    const accountId = (request.query as any)[accountIdParam] || (request.params as any)[accountIdParam];

    if (user.role === "TRADER") {
      // TRADER can only access own accounts
      if (!accountId || !user.accountIds.includes(accountId)) {
        return reply.status(404).type("application/problem+json").send({
          type: "about:blank#not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "Account not found",
          instance: request.url,
          requestId: request.id,
        });
      }
    } else if (user.role !== "ADMIN") {
      // RISK/OPS/ADMIN require explicit accountId
      if (!accountId) {
        return reply.status(400).type("application/problem+json").send({
          type: "about:blank#validation_failed",
          title: "Validation error",
          status: 400,
          code: "validation_failed",
          detail: `${accountIdParam} is required`,
          instance: request.url,
          requestId: request.id,
        });
      }
    }

    // Attach accountId to request for route handlers
    (request as any).accountId = accountId;
  };
}
