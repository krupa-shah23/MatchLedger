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
      // TODO: query recon_runs from database
      return reply.code(200).send([]);
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
      // TODO: query breaks from database, optionally filtered by runId
      return reply.code(200).send([]);
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
      // TODO: query audit trail from database (status changes and resolutions)
      return reply.code(200).send([]);
    }
  );
}
