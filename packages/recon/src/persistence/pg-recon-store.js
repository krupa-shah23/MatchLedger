export class PgReconStore {
    sql;
    constructor(sql) {
        this.sql = sql;
    }
    async startRun(run) {
        await this.sql.query(`INSERT INTO recon_runs (run_id, file_hash, cutoff_ts, price_decimals, counts_json)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, [run.runId, run.fileHash, run.cutoffTs, run.priceDecimals, run.countsJson]);
    }
    async addBreak(brk) {
        await this.sql.query(`INSERT INTO recon_breaks (break_id, run_id, type, status, details)
       VALUES ($1, $2, $3, $4, $5)`, [brk.breakId, brk.runId, brk.type, brk.status, brk.details]);
    }
    async transitionBreak(breakId, fromStatus, toStatus, reason, actor) {
        await this.sql.query(`UPDATE recon_breaks SET status = $1 WHERE break_id = $2 AND status = $3`, [toStatus, breakId, fromStatus]);
        await this.sql.query(`INSERT INTO recon_audit (break_id, from_status, to_status, reason, actor, ts)
       VALUES ($1, $2, $3, $4, $5, $6)`, [breakId, fromStatus, toStatus, reason, actor, Date.now()]);
    }
    async getBreaks(runId, status) {
        const query = status
            ? `SELECT break_id, run_id, type, status, details FROM recon_breaks WHERE run_id = $1 AND status = $2`
            : `SELECT break_id, run_id, type, status, details FROM recon_breaks WHERE run_id = $1`;
        const params = status ? [runId, status] : [runId];
        const res = await this.sql.query(query, params);
        return res.rows.map((row) => ({
            breakId: row.break_id,
            runId: row.run_id,
            type: row.type,
            status: row.status,
            details: row.details,
        }));
    }
}
