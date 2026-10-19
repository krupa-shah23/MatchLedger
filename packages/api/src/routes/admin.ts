/**
 * Admin routes: users, accounts, deposit
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { hashPassword } from "../auth/passwords.js";
import type { SqlExecutor } from "../auth/users.js";
import type { RuntimeFacade } from "../orders/submit.js";

const CreateUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["TRADER", "RISK", "OPS", "ADMIN"]),
});

const CreateAccountSchema = z.object({
  accountId: z.string().min(1),
  ownerUserId: z.string().min(1),
});

const DepositSchema = z.object({
  requestId: z.string().min(1),
  asset: z.string().min(1),
  amount: z.string().min(1),
});

export interface AdminRoutesDeps {
  executor: SqlExecutor;
  facade: RuntimeFacade;
}

export async function registerAdminRoutes(app: FastifyInstance, deps: AdminRoutesDeps): Promise<void> {
  // GET /admin/users - list users
  app.get<{ Querystring: unknown }>(
    "/admin/users",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: query users from database
      return reply.code(200).send([]);
    }
  );

  // POST /admin/users - create user
  app.post<{ Body: unknown }>(
    "/admin/users",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = CreateUserSchema.parse(request.body);

        // Hash password
        const passwordHash = await hashPassword(body.password);

        // TODO: insert user into database, check for duplicate username
        const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        return reply.code(200).send({
          userId,
          username: body.username,
          role: body.role,
        });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message,
            instance: "/admin/users",
            requestId: request.id,
            errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          });
        }
        if (err.message?.includes("UNIQUE")) {
          return reply.status(409).type("application/problem+json").send({
            type: "about:blank#conflict",
            title: "Conflict",
            status: 409,
            code: "conflict",
            detail: "Username already exists",
            instance: "/admin/users",
            requestId: request.id,
          });
        }
        throw err;
      }
    }
  );

  // GET /admin/accounts - list accounts
  app.get<{ Querystring: unknown }>(
    "/admin/accounts",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: query accounts from database with owner info
      return reply.code(200).send([]);
    }
  );

  // POST /admin/accounts - create account
  app.post<{ Body: unknown }>(
    "/admin/accounts",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = CreateAccountSchema.parse(request.body);

        // TODO: insert account and user_accounts link
        return reply.code(200).send({
          accountId: body.accountId,
          ownerUserId: body.ownerUserId,
        });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message,
            instance: "/admin/accounts",
            requestId: request.id,
          });
        }
        throw err;
      }
    }
  );

  // POST /admin/accounts/{id}/deposit - deposit funds
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/admin/accounts/:id/deposit",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      try {
        const body = DepositSchema.parse(request.body);

        // TODO: call facade.deposit(accountId, asset, amount, requestId) and await journal
        await deps.facade.deposit(params.id, body.asset, BigInt(body.amount), body.requestId);

        return reply.status(202).send({ accountId: params.id });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message,
            instance: `/admin/accounts/${params.id}/deposit`,
            requestId: request.id,
          });
        }
        throw err;
      }
    }
  );
}
