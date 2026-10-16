 
import { createHash } from "node:crypto";
import { toSafeNumber } from "./pool.js";
export class PgSnapshotStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(record) {
        const stateJson = JSON.stringify(record.state);
        const checksum = createHash("sha256").update(stateJson).digest("hex");
        try {
            await this.pool.query("INSERT INTO snapshots (stream_id, last_seq, last_ts, schema_version, state_json, checksum) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (stream_id, last_seq) DO NOTHING", [record.stream, record.lastSeq, record.lastTs, 1, stateJson, checksum]);
        }
        catch {
            // ignore
        }
    }
    async listCandidates(stream, opts) {
        const result = await this.pool.query("SELECT last_seq, last_ts, schema_version, state_json, checksum FROM snapshots WHERE stream_id = $1 AND last_seq <= $2 ORDER BY last_seq DESC LIMIT 10", [stream, opts.maxSeq]);
        return result.rows.map((row) => {
            const stateJson = JSON.stringify(row.state_json);
            const expectedChecksum = createHash("sha256").update(stateJson).digest("hex");
            const checksumMatch = expectedChecksum === row.checksum;
            return {
                lastSeq: toSafeNumber(row.last_seq),
                lastTs: toSafeNumber(row.last_ts),
                version: toSafeNumber(row.schema_version),
                data: row.state_json,
                invalid: !checksumMatch ? "CHECKSUM" : undefined,
            };
        });
    }
    async prune(stream, keep) {
        const result = await this.pool.query("SELECT last_seq FROM snapshots WHERE stream_id = $1 ORDER BY last_seq DESC LIMIT 1 OFFSET $2", [stream, keep]);
        if (result.rows.length > 0) {
            const lastSeqToKeep = result.rows[0].last_seq;
            await this.pool.query("DELETE FROM snapshots WHERE stream_id = $1 AND last_seq < $2", [stream, lastSeqToKeep]);
        }
    }
}
