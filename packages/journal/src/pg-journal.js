import { toSafeNumber } from "./pool.js";
export class JournalSequenceError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "JournalSequenceError";
    }
}
export class JournalConflictError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "JournalConflictError";
    }
}
export class PgJournal {
    pool;
    writerEpoch;
    constructor(pool, writerEpoch) {
        this.pool = pool;
        this.writerEpoch = writerEpoch;
    }
    async append(batch) {
        if (batch.length === 0)
            return;
        const bySeq = new Map();
        for (const item of batch) {
            const last = bySeq.get(item.symbol) ?? 0;
            if (item.seq !== last + 1)
                throw new JournalSequenceError(`dup/gap seq in batch for ${item.symbol}`);
            bySeq.set(item.symbol, item.seq);
        }
        const values = [];
        const rows = [];
        for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            values.push(item.symbol, item.seq, "COMMAND", 0, 1, item.ts, this.writerEpoch, JSON.stringify(item.command));
            rows.push(`($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`);
        }
        const sql = "INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json) VALUES " + rows.join(",");
        try {
            await this.pool.query(sql, values);
        }
        catch (error) {
            throw new JournalConflictError(String(error));
        }
    }
    async appendEvents(batch) {
        if (batch.length === 0)
            return;
        const values = [];
        let sql = "INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json) VALUES ";
        let idx = 0;
        const rows = [];
        for (const output of batch) {
            for (let i = 0; i < output.events.length; i++) {
                values.push(output.symbol, output.seq, "EVENT", i, 1, output.ts, this.writerEpoch, JSON.stringify(output.events[i]));
                rows.push(`($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`);
                idx++;
            }
        }
        if (rows.length === 0)
            return;
        sql += rows.join(",") + " ON CONFLICT DO NOTHING";
        await this.pool.query(sql, values);
    }
    async lastCommandSeq(symbol) {
        const result = await this.pool.query("SELECT MAX(seq) as max_seq FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND'", [symbol]);
        const max = result.rows[0]?.max_seq;
        return max ? toSafeNumber(max) : 0;
    }
    async readCommands(symbol, fromSeq, chunkSize) {
        const result = await this.pool.query("SELECT seq, ts, payload_json as command FROM journal WHERE stream_id = $1 AND record_type = 'COMMAND' AND seq > $2 ORDER BY seq LIMIT $3", [symbol, fromSeq, chunkSize]);
        return result.rows.map((row) => ({
            seq: toSafeNumber(row.seq),
            ts: toSafeNumber(row.ts),
            command: row.command,
        }));
    }
    async readEvents(symbol, fromSeq, toSeq) {
        const result = await this.pool.query("SELECT seq, ts, payload_json as payload FROM journal WHERE stream_id = $1 AND record_type = 'EVENT' AND seq >= $2 AND seq <= $3 ORDER BY seq, idx", [symbol, fromSeq, toSeq]);
        return result.rows.map((row) => ({
            seq: toSafeNumber(row.seq),
            ts: toSafeNumber(row.ts),
            payload: row.payload,
        }));
    }
}
