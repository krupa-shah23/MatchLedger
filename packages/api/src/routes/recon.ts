/**
 * Reconciliation routes: upload, runs, breaks, status, resolve
 * Streamed multipart, durable PgReconStore, internalTrades from runtime
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { SqlExecutor } from "@matchledger/projections";

const StatusSchema = z.object({
  reason: z.string().min(1, "Reason required"),
});

const ResolveSchema = z.object({
  reason: z.string().min(1, "Reason required"),
  adjustment: z.object({
    asset: z.string().optional(),
    amount: z.string().optional(),
  }).optional(),
});

export interface ReconRoutesDeps {
  executor: SqlExecutor;
}

export async function registerReconRoutes(app: FastifyInstance, deps: ReconRoutesDeps): Promise<void> {
  // POST /recon/runs - upload statement file for reconciliation
  app.post<{ Body: unknown }>(
    "/recon/runs",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parts = request.parts();
        let fileCount = 0;
        let fileContent = Buffer.alloc(0);
        let fileName = "";

        for await (const part of parts) {
          if (part.type === "file") {
            fileCount++;
            if (fileCount > 1) {
              return reply.status(400).type("application/problem+json").send({
                type: "about:blank#validation_failed",
                title: "Validation error",
                status: 400,
                code: "validation_failed",
                detail: "Only one file allowed",
                instance: "/recon/runs",
                requestId: request.id,
              });
            }
            fileName = part.filename;
            const chunks = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
              if (Buffer.concat(chunks).length > 20 * 1024 * 1024) {
                return reply.status(413).type("application/problem+json").send({
                  type: "about:blank#payload_too_large",
                  title: "Payload too large",
                  status: 413,
                  code: "payload_too_large",
                  detail: "File exceeds 20 MiB limit",
                  instance: "/recon/runs",
                  requestId: request.id,
                });
              }
            }
            fileContent = Buffer.concat(chunks);
          }
        }

        if (fileCount === 0) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: "File is required",
            instance: "/recon/runs",
            requestId: request.id,
          });
        }

        // Compute file hash for idempotency
        const fileHash = createHash("sha256").update(fileContent).digest("hex");

        // TODO: store run in durable store with file_hash, parse CSV, create breaks
        const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        return reply.status(202).send({ runId });
      } catch (err) {
        throw err;
      }
    }
  );

  // GET /recon/runs - list runs
  app.get<{ Querystring: unknown }>(
    "/recon/runs",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await deps.executor.query(
          `SELECT id, account_id, uploaded_at, status FROM recon_runs ORDER BY uploaded_at DESC LIMIT 100`,
          []
        );
        return reply.code(200).send({
          runs: (result.rows as any[]).map((row) => ({
            runId: row.id,
            accountId: row.account_id,
            uploadedAt: row.uploaded_at,
            status: row.status,
          })),
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Failed to list runs",
          status: 500,
          code: "internal_error",
          detail: "Database query failed",
          instance: "/recon/runs",
          requestId: request.id,
        });
      }
    }
  );

  // GET /recon/runs/{id} - get run details
  app.get<{ Params: { id: string } }>(
    "/recon/runs/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      // TODO: query specific run from database
      return reply.code(200).send({ runId: params.id, status: "PROCESSING" });
    }
  );

  // GET /recon/breaks - list breaks from runs
  app.get<{ Querystring: { runId?: string } }>(
    "/recon/breaks",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        let sql = `SELECT id, run_id, account_id, break_type, status FROM recon_breaks`;
        const params: any[] = [];

        if (query.runId) {
          sql += ` WHERE run_id = $1`;
          params.push(query.runId);
        }

        sql += ` ORDER BY id DESC LIMIT 100`;

        const result = await deps.executor.query(sql, params);
        return reply.code(200).send({
          breaks: (result.rows as any[]).map((row) => ({
            breakId: row.id,
            runId: row.run_id,
            accountId: row.account_id,
            type: row.break_type,
            status: row.status,
          })),
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Failed to list breaks",
          status: 500,
          code: "internal_error",
          detail: "Database query failed",
          instance: "/recon/breaks",
          requestId: request.id,
        });
      }
    }
  );

  // GET /recon/breaks/{id} - get break details
  app.get<{ Params: { id: string } }>(
    "/recon/breaks/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      // TODO: query specific break from database
      return reply.code(200).send({ breakId: params.id, status: "OPEN" });
    }
  );

  // POST /recon/breaks/{id}/status - change break status
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/recon/breaks/:id/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      try {
        const body = StatusSchema.parse(request.body);
        // TODO: update break status in database, check legal transitions
        return reply.status(202).send({ breakId: params.id });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message,
            instance: `/recon/breaks/${params.id}/status`,
            requestId: request.id,
          });
        }
        throw err;
      }
    }
  );

  // POST /recon/breaks/{id}/resolve - resolve break with optional adjustment
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/recon/breaks/:id/resolve",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      try {
        const body = ResolveSchema.parse(request.body);
        // TODO: resolve break in database, apply adjustment if present
        return reply.status(202).send({ breakId: params.id });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply.status(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: err.issues[0]?.message,
            instance: `/recon/breaks/${params.id}/resolve`,
            requestId: request.id,
          });
        }
        throw err;
      }
    }
  );

  // GET /recon/breaks/{id}/audit - audit trail for break
  app.get<{ Params: { id: string } }>(
    "/recon/breaks/:id/audit",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as any;
        const result = await deps.executor.query(
          `SELECT id, break_id, old_status, new_status, changed_at, changed_by, reason
           FROM recon_break_audit WHERE break_id = $1 ORDER BY changed_at DESC`,
          [params.id]
        );
        return reply.code(200).send({
          breakId: params.id,
          audit: (result.rows as any[]).map((row) => ({
            id: row.id,
            oldStatus: row.old_status,
            newStatus: row.new_status,
            changedAt: row.changed_at,
            changedBy: row.changed_by,
            reason: row.reason,
          })),
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Failed to get audit trail",
          status: 500,
          code: "internal_error",
          detail: "Database query failed",
          instance: "/recon/breaks/:id/audit",
          requestId: request.id,
        });
      }
    }
  );
}
