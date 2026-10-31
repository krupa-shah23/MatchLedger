/**
 * Reconciliation routes: upload, runs, breaks, status, resolve
 * Streamed multipart, durable PgReconStore, internalTrades from runtime
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { RecordParser, classify, type StatementRow, type InternalTradeRecord } from "@matchledger/recon";
import { createHash } from "node:crypto";
import type { SqlExecutor } from "@matchledger/projections";

export const RECON_UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024;

const StatusSchema = z.object({
  status: z.enum(["INVESTIGATING"]),
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
        const hash = createHash("sha256");
        const parser = new RecordParser();
        let bytes = 0;
        let fileName = "";
        for await (const part of parts) {
          if (part.type !== "file") continue;
          if (++fileCount > 1) return reply.status(400).send({ detail: "Only one file allowed" });
          fileName = part.filename;
          for await (const chunk of part.file) {
            bytes += chunk.length;
            if (bytes > RECON_UPLOAD_LIMIT_BYTES) return reply.status(413).send({ detail: "File exceeds 20 MiB limit" });
            hash.update(chunk);
            parser.push(chunk);
          }
          if (part.file.truncated) return reply.status(413).send({ detail: "File exceeds upload limit" });
        }
        if (!fileCount) return reply.status(400).send({ detail: "File is required" });
        const rows = parser.finish();
        const expected = ["tradeId", "symbol", "quantity", "price", "tradeTs", "settlementDate"];
        if (parser.getErrors().length || rows[0]?.join(",") !== expected.join(",")) {
          return reply.status(400).send({ detail: "Expected CSV header: " + expected.join(",") });
        }
        const statements: StatementRow[] = [];
        for (const row of rows.slice(1)) {
          const [tradeId, symbol, quantity, price, tradeTs, settlementDate] = row;
          if (row.length !== 6 || !tradeId || !symbol || !quantity || !/^[1-9][0-9]*$/.test(quantity) ||
              !price || !/^\d+(\.\d{1,2})?$/.test(price) || !tradeTs || !/^\d+$/.test(tradeTs) || !settlementDate) {
            return reply.status(400).send({ detail: "Invalid statement row" });
          }
          statements.push({ tradeId, symbol, quantity, price, tradeTs, settlementDate });
        }
        const cutoff = Date.now();
        const internalRows = await deps.executor.query(`SELECT t.trade_id,t.symbol,t.price::text,t.quantity::text,t.ts,
          (SELECT o.account_id FROM order_fills f JOIN orders_view o ON o.order_id=f.order_id WHERE f.trade_id=t.trade_id AND o.side='BUY' LIMIT 1) AS buyer_account_id,
          (SELECT o.account_id FROM order_fills f JOIN orders_view o ON o.order_id=f.order_id WHERE f.trade_id=t.trade_id AND o.side='SELL' LIMIT 1) AS seller_account_id
          FROM trades_view t WHERE t.ts <= $1`, [cutoff]);
        const internal: InternalTradeRecord[] = (internalRows.rows as Array<{ trade_id: string; symbol: string; price: string; quantity: string; ts: string; buyer_account_id?: string; seller_account_id?: string }>).map(r => ({
          tradeId: r.trade_id, symbol: r.symbol, price: BigInt(r.price), quantity: BigInt(r.quantity), ts: +r.ts,
          buyerAccountId: r.buyer_account_id ?? "", sellerAccountId: r.seller_account_id ?? "",
        }));
        const breaks = classify({ cutoffTs: cutoff, priceDecimals: 2, settlementLagDays: 2, internalTrades: internal, statementRows: statements });
        const fileHash = hash.digest("hex");
        const runId = "run_" + fileHash;
        const json = (value: unknown) => JSON.stringify(value, (_, v: unknown) => typeof v === "bigint" ? v.toString() : v);
        const counts = Object.fromEntries([...new Set(breaks.map(b => b.type))].map(type => [type, breaks.filter(b => b.type === type).length]));
        await deps.executor.transaction(async tx => {
          const inserted = await tx.query(`INSERT INTO recon_runs (run_id,source,file_hash,cutoff_ts,price_decimals,settlement_lag_days,rows_read,parse_errors_json,counts_json,started_at,finished_at)
            VALUES ($1,$2,$3,$4,2,2,$5,'[]',$6,now(),now()) ON CONFLICT (file_hash) DO NOTHING RETURNING run_id`,
            [runId, fileName, fileHash, cutoff, statements.length, json(counts)]);
          if (!inserted.rows.length) return;
          for (const [i, def] of breaks.entries()) {
            await tx.query(`INSERT INTO recon_breaks (break_id,run_id,type,trade_id,internal_json,external_json,status)
              VALUES ($1,$2,$3,$4,$5,$6,'OPEN')`, [runId + ":" + i, runId, def.type, def.tradeId,
              json({ ...def, accountIds: [...new Set([internal.find(trade => trade.tradeId === def.tradeId)?.buyerAccountId, internal.find(trade => trade.tradeId === def.tradeId)?.sellerAccountId].filter(Boolean))] }),
              json(statements.filter(r => r.tradeId === def.tradeId))]);
          }
        });
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
          `SELECT run_id, source, started_at, finished_at, rows_read, counts_json FROM recon_runs ORDER BY started_at DESC LIMIT 100`,
          []
        );
        return reply.code(200).send({
          runs: (result.rows as any[]).map((row) => ({
            runId: row.run_id,
            source: row.source,
            startedAt: row.started_at,
            durationMs: new Date(row.finished_at).getTime() - new Date(row.started_at).getTime(),
            rowsRead: row.rows_read,
            breaksFound: Object.values(row.counts_json as Record<string, number>).reduce((a, b) => a + b, 0),
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
      try {
        const params = request.params as any;
        const result = await deps.executor.query(
          `SELECT run_id, source, started_at, finished_at, rows_read, counts_json FROM recon_runs WHERE run_id = $1`,
          [params.id]
        );
        if (result.rows.length === 0) {
          return reply.code(404).type("application/problem+json").send({
            type: "about:blank#not_found",
            title: "Run not found",
            status: 404,
            code: "not_found",
            detail: `Run ${params.id} not found`,
            instance: "/recon/runs/:id",
            requestId: request.id,
          });
        }
        const row = result.rows[0] as any;
        return reply.code(200).send({
          runId: row.id,
          accountId: row.account_id,
          uploadedAt: row.uploaded_at,
          status: row.status,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Failed to get run",
          status: 500,
          code: "internal_error",
          detail: "Database query failed",
          instance: "/recon/runs/:id",
          requestId: request.id,
        });
      }
    }
  );

  // GET /recon/breaks - list breaks from runs
  app.get<{ Querystring: { runId?: string } }>(
    "/recon/breaks",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        let sql = `SELECT break_id, run_id, type, trade_id, status, internal_json, external_json FROM recon_breaks`;
        const params: any[] = [];

        if (query.runId) {
          sql += ` WHERE run_id = $1`;
          params.push(query.runId);
        }

        sql += ` ORDER BY created_at DESC, break_id DESC LIMIT 100`;

        const result = await deps.executor.query(sql, params);
        return reply.code(200).send({
          breaks: (result.rows as any[]).map((row) => ({
            breakId: row.break_id,
            runId: row.run_id,
            accountId: row.internal_json?.accountIds?.join(", ") || row.internal_json?.accountId || "—",
            type: row.type,
            status: row.status,
            asset: "CASH",
            expected: minorToDecimal(row.internal_json?.internalPrice),
            actual: minorToDecimal(row.external_json?.[0]?.price, true),
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
      try {
        const params = request.params as any;
        const result = await deps.executor.query(
          `SELECT break_id, run_id, type, status, internal_json, external_json FROM recon_breaks WHERE break_id = $1`,
          [params.id]
        );
        if (result.rows.length === 0) {
          return reply.code(404).type("application/problem+json").send({
            type: "about:blank#not_found",
            title: "Break not found",
            status: 404,
            code: "not_found",
            detail: `Break ${params.id} not found`,
            instance: "/recon/breaks/:id",
            requestId: request.id,
          });
        }
        const row = result.rows[0] as any;
        const internal = row.internal_json ?? {};
        const external = row.external_json?.[0] ?? {};
        return reply.code(200).send({
          breakId: row.break_id,
          runId: row.run_id,
          tradeId: row.trade_id,
          accountId: internal.accountIds?.join(", ") || internal.accountId || "—",
          type: row.type,
          status: row.status,
          asset: "CASH",
          expected: minorToDecimal(internal.internalPrice),
          actual: minorToDecimal(external.price, true),
          definition: internal,
          statement: external,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Failed to get break",
          status: 500,
          code: "internal_error",
          detail: "Database query failed",
          instance: "/recon/breaks/:id",
          requestId: request.id,
        });
      }
    }
  );

  // POST /recon/breaks/{id}/status - change break status
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/recon/breaks/:id/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as any;
      try {
        const body = StatusSchema.parse(request.body);
        await deps.executor.transaction(async tx => {
          const current = await tx.query(`SELECT status FROM recon_breaks WHERE break_id = $1 FOR UPDATE`, [params.id]);
          if (!current.rows.length) throw new Error("Break not found");
          const previous = String((current.rows[0] as { status: string }).status);
          if (previous === "RESOLVED" || previous === "WRITTEN_OFF") throw new Error("Break already closed");
          if (previous !== "OPEN") return;
          const updated = await tx.query(`UPDATE recon_breaks SET status=$2, reason=$3, updated_at=now() WHERE break_id=$1 AND status=$4 RETURNING break_id`, [params.id, body.status, body.reason, previous]);
          if (updated.rows.length) {
            const actor = (request as FastifyRequest & { user?: { userId?: string; sub?: string } }).user?.userId
              ?? (request as FastifyRequest & { user?: { sub?: string } }).user?.sub ?? "operator";
            await tx.query(`INSERT INTO recon_audit (break_id,from_status,to_status,reason,actor,ts) VALUES ($1,$2,$3,$4,$5,$6)`, [params.id, previous, body.status, body.reason, actor, Date.now()]);
          }
        });
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
        if (err instanceof Error && err.message === "Break not found") return reply.code(404).send({ detail: err.message });
        if (err instanceof Error && err.message === "Break already closed") return reply.code(409).send({ detail: err.message });
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Failed to update break status",
          status: 500,
          code: "internal_error",
          detail: "Database update failed",
          instance: `/recon/breaks/${params.id}/status`,
          requestId: request.id,
        });
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
        // Resolve break in database, apply adjustment if present
        await deps.executor.transaction(async tx => {
          const current = await tx.query(`SELECT status, resolved_by FROM recon_breaks WHERE break_id = $1 FOR UPDATE`, [params.id]);
          if (!current.rows.length) throw new Error("Break not found");
          const row = current.rows[0] as { status: string; resolved_by: string | null };
          if (row.status === "RESOLVED" || row.status === "WRITTEN_OFF") {
            return;
          }
          const actor = (request as FastifyRequest & { user?: { username?: string; sub?: string } }).user?.username
            ?? (request as FastifyRequest & { user?: { sub?: string } }).user?.sub ?? "operator";
          const updated = await tx.query(
            `UPDATE recon_breaks SET status='RESOLVED', reason=$2, resolved_by=$3, updated_at=now() WHERE break_id=$1 AND status IN ('OPEN','INVESTIGATING') RETURNING break_id`,
            [params.id, body.reason, actor]
          );
          if (updated.rows.length) {
            await tx.query(
              `INSERT INTO recon_audit (break_id,from_status,to_status,reason,actor,ts,adjustment_id)
               VALUES ($1,$2,'RESOLVED',$3,$4,$5,$6)`,
              [params.id, row.status, body.reason, actor, Date.now(), body.adjustment ? `adjustment:${params.id}` : null]
            );
          }
        });
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
        if (err instanceof Error && err.message === "Break not found") {
          return reply.code(404).type("application/problem+json").send({
            type: "about:blank#not_found", title: "Break not found", status: 404,
            code: "not_found", detail: err.message, instance: `/recon/breaks/${params.id}/resolve`, requestId: request.id,
          });
        }
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Failed to resolve break",
          status: 500,
          code: "internal_error",
          detail: "Database update failed",
          instance: `/recon/breaks/${params.id}/resolve`,
          requestId: request.id,
        });
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
          `SELECT seq AS id, break_id, from_status AS old_status, to_status AS new_status, ts AS changed_at, actor AS changed_by, reason
           FROM recon_audit WHERE break_id = $1 ORDER BY ts DESC`,
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

function minorToDecimal(value: unknown, alreadyDecimal = false): string {
  if (value === undefined || value === null) return "0.00";
  if (alreadyDecimal) return String(value);
  const minor = BigInt(String(value));
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
