import type { SqlExecutor } from "@matchledger/journal";

export type WorkflowStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "WRITTEN_OFF";

export type StoredRun = {
  readonly runId: string;
  readonly fileHash: string;
  readonly source: string;
  readonly cutoffTs: number;
  readonly priceDecimals: number;
  readonly settlementLagDays: number;
  readonly rowsRead: number;
  readonly parseErrorsJson: string;
  readonly countsJson: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly created: boolean;
};

export type StoredBreak = {
  readonly breakId: string;
  readonly runId: string;
  readonly type: string;
  readonly tradeId: string;
  readonly internalJson?: string;
  readonly externalJson?: string;
  readonly status: WorkflowStatus;
  readonly reason?: string;
  readonly resolvedBy?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type AuditEntry = {
  readonly seq: number;
  readonly breakId: string;
  readonly fromStatus: WorkflowStatus;
  readonly toStatus: WorkflowStatus;
  readonly reason: string;
  readonly actor: string;
  readonly ts: number;
  readonly adjustmentId?: string;
};

export class BreakNotFoundError extends Error {
  public constructor(breakId: string) {
    super(`Break not found: ${breakId}`);
    this.name = "BreakNotFoundError";
  }
}

export class ConcurrentModificationError extends Error {
  public constructor(breakId: string, expectedStatus: WorkflowStatus) {
    super(`Break ${breakId} is no longer in ${expectedStatus} status`);
    this.name = "ConcurrentModificationError";
    (this as any).code = "CONCURRENT_MODIFICATION";
  }
}

export class PgReconStore {
  constructor(private readonly sql: SqlExecutor) {}

  async createRun(run: StoredRun & { breaks: readonly { readonly breakId: string; readonly runId: string; readonly type: string; readonly tradeId: string; readonly internalJson?: string; readonly externalJson?: string }[] }): Promise<{ created: boolean; runId: string }> {
    const runResult = await this.sql.query(
      `INSERT INTO recon_runs (run_id, source, file_hash, cutoff_ts, price_decimals, settlement_lag_days, rows_read, parse_errors_json, counts_json, started_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (file_hash) DO NOTHING
       RETURNING run_id`,
      [run.runId, run.source, run.fileHash, run.cutoffTs, run.priceDecimals, run.settlementLagDays, run.rowsRead, run.parseErrorsJson, run.countsJson, new Date(run.startedAt).toISOString(), new Date(run.finishedAt).toISOString()],
    );

    if ((runResult.rowCount ?? 0) > 0) {
      // New run created, insert breaks
      if (run.breaks.length > 0) {
        const breakIds = run.breaks.map((b) => b.breakId);
        const runIds = run.breaks.map((b) => b.runId);
        const types = run.breaks.map((b) => b.type);
        const tradeIds = run.breaks.map((b) => b.tradeId);
        const internalJsons = run.breaks.map((b) => (b.internalJson ? JSON.parse(b.internalJson) : null));
        const externalJsons = run.breaks.map((b) => (b.externalJson ? JSON.parse(b.externalJson) : null));
        const statuses = run.breaks.map(() => "OPEN");

        await this.sql.query(
          `INSERT INTO recon_breaks (break_id, run_id, type, trade_id, internal_json, external_json, status)
           SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::jsonb[], $6::jsonb[], $7::text[])`,
          [breakIds, runIds, types, tradeIds, internalJsons, externalJsons, statuses],
        );
      }
      return { created: true, runId: run.runId };
    }

    return { created: false, runId: run.fileHash };
  }

  async transition(breakId: string, fromStatus: WorkflowStatus, toStatus: WorkflowStatus, reason: string, actor: string, ts: number, adjustmentId?: string): Promise<void> {
    // Terminal states cannot transition
    if (fromStatus === "RESOLVED" || fromStatus === "WRITTEN_OFF") {
      throw new ConcurrentModificationError(breakId, fromStatus);
    }

    const updateResult = await this.sql.query(
      `UPDATE recon_breaks SET status = $1, resolved_by = CASE WHEN $1 IN ('RESOLVED', 'WRITTEN_OFF') THEN $2 ELSE NULL END, updated_at = now()
       WHERE break_id = $3 AND status = $4 RETURNING *`,
      [toStatus, actor, breakId, fromStatus],
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      const existingResult = await this.sql.query(`SELECT status FROM recon_breaks WHERE break_id = $1`, [breakId]);
      if (existingResult.rows.length === 0) {
        throw new BreakNotFoundError(breakId);
      }
      throw new ConcurrentModificationError(breakId, fromStatus);
    }

    await this.sql.query(
      `INSERT INTO recon_audit (break_id, from_status, to_status, reason, actor, ts, adjustment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [breakId, fromStatus, toStatus, reason, actor, ts, adjustmentId],
    );
  }

  async getAudit(breakId: string): Promise<readonly AuditEntry[]> {
    const result = await this.sql.query(
      `SELECT seq, break_id, from_status, to_status, reason, actor, ts, adjustment_id FROM recon_audit WHERE break_id = $1 ORDER BY seq`,
      [breakId],
    );
    return result.rows.map((row) => ({
      seq: row.seq,
      breakId: row.break_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      reason: row.reason,
      actor: row.actor,
      ts: row.ts,
      adjustmentId: row.adjustment_id,
    }));
  }

  async listBreaks(filters?: { runId?: string; type?: string; status?: WorkflowStatus }): Promise<readonly StoredBreak[]> {
    let query = `SELECT break_id, run_id, type, trade_id, internal_json, external_json, status, reason, resolved_by, created_at, updated_at FROM recon_breaks`;
    const params: any[] = [];

    if (filters?.runId || filters?.type || filters?.status) {
      const conditions: string[] = [];
      if (filters.runId) {
        conditions.push(`run_id = $${params.length + 1}`);
        params.push(filters.runId);
      }
      if (filters.type) {
        conditions.push(`type = $${params.length + 1}`);
        params.push(filters.type);
      }
      if (filters.status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(filters.status);
      }
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY trade_id, type, break_id`;

    const result = await this.sql.query(query, params);
    return result.rows.map((row) => ({
      breakId: row.break_id,
      runId: row.run_id,
      type: row.type,
      tradeId: row.trade_id,
      internalJson: row.internal_json ? JSON.stringify(row.internal_json) : undefined,
      externalJson: row.external_json ? JSON.stringify(row.external_json) : undefined,
      status: row.status,
      reason: row.reason,
      resolvedBy: row.resolved_by,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));
  }

  async listRuns(): Promise<readonly StoredRun[]> {
    const result = await this.sql.query(
      `SELECT run_id, source, file_hash, cutoff_ts, price_decimals, settlement_lag_days, rows_read, parse_errors_json, counts_json, started_at, finished_at FROM recon_runs ORDER BY started_at DESC`,
      [],
    );
    return result.rows.map((row) => ({
      runId: row.run_id,
      source: row.source,
      fileHash: row.file_hash,
      cutoffTs: row.cutoff_ts,
      priceDecimals: row.price_decimals,
      settlementLagDays: row.settlement_lag_days,
      rowsRead: row.rows_read,
      parseErrorsJson: JSON.stringify(row.parse_errors_json),
      countsJson: JSON.stringify(row.counts_json),
      startedAt: new Date(row.started_at).getTime(),
      finishedAt: new Date(row.finished_at).getTime(),
      created: true,
    }));
  }
}
