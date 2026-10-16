export class PgLedgerStore {
    sql;
    constructor(sql) {
        this.sql = sql;
    }
    async appendLedgerEntries(entries) {
        if (entries.length === 0)
            return;
        for (const entry of entries) {
            await this.sql.query(`INSERT INTO ledger_entries (tx_id, leg_idx, account_id, asset, amount, direction, ref_event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`, [
                entry.txId,
                entry.legIdx,
                entry.accountId,
                entry.asset,
                entry.amount,
                entry.direction,
                entry.refEventId,
            ]);
        }
    }
    async getBalance(accountId, asset) {
        const res = await this.sql.query(`SELECT COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END), 0) as balance
       FROM ledger_entries WHERE account_id = $1 AND asset = $2`, [accountId, asset]);
        return Number(res.rows[0].balance) || 0;
    }
    async verifyZeroSum() {
        const res = await this.sql.query(`SELECT SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END) as total FROM ledger_entries`);
        const total = res.rows[0]?.total;
        return total === null || total === 0;
    }
}
