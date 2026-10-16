import type { SqlExecutor } from "@matchledger/journal";

export interface ReconRun {
  runId: string;
  fileHash: string;
  cutoffTs: number;
  priceDecimals: number;
  countsJson: string;
}

export interface ReconBreak {
  breakId: string;
  runId: string;
  type: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "WRITTEN_OFF";
  details: string;
}

export class PgReconStore {
  constructor(private sql: SqlExecutor) {}

  async startRun(run: ReconRun): Promise<void> {
    await this.sql.query(
      `INSERT INTO recon_runs (run_id, file_hash, cutoff_ts, price_decimals, counts_json)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [run.runId, run.fileHash, run.cutoffTs, run.priceDecimals, run.countsJson]
    );
  }

  async addBreak(brk: ReconBreak): Promise<void> {
    await this.sql.query(
      `INSERT INTO recon_breaks (break_id, run_id, type, status, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [brk.breakId, brk.runId, brk.type, brk.status, brk.details]
    );
  }

  async transitionBreak(
    breakId: string,
    fromStatus: string,
    toStatus: string,
    reason: string,
    actor: string
  ): Promise<void> {
    await this.sql.query(
      `UPDATE recon_breaks SET status = $1 WHERE break_id = $2 AND status = $3`,
      [toStatus, breakId, fromStatus]
    );
    await this.sql.query(
      `INSERT INTO recon_audit (break_id, from_status, to_status, reason, actor, ts)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [breakId, fromStatus, toStatus, reason, actor, Date.now()]
    );
  }

  async getBreaks(runId: string, status?: string): Promise<readonly ReconBreak[]> {
    const query = status
      ? `SELECT break_id, run_id, type, status, details FROM recon_breaks WHERE run_id = $1 AND status = $2`
      : `SELECT break_id, run_id, type, status, details FROM recon_breaks WHERE run_id = $1`;
    const params = status ? [runId, status] : [runId];
    const res = await this.sql.query(query, params);
    return res.rows.map((row: any) => ({
      breakId: row.break_id,
      runId: row.run_id,
      type: row.type,
      status: row.status,
      details: row.details,
    }));
  }
}
