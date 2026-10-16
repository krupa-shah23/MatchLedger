import type { SqlExecutor } from "@matchledger/journal";
import type { LedgerEntry, LedgerTx } from "./ledger.js";
import { Ledger, UnbalancedTransactionError } from "./ledger.js";

export class LedgerConflictError extends Error {
  public constructor(message = "Ledger conflict: partial or divergent legs") {
    super(message);
    this.name = "LedgerConflictError";
  }
}

export class PgLedgerStore {
  public constructor(private readonly sql: SqlExecutor) {}

  async appendTx(tx: LedgerTx): Promise<{ posted: boolean }> {
    // Pure layer validation: unbalanced throws immediately, zero SQL issued
    const byAsset = new Map<string, bigint>();
    for (const leg of tx.legs) {
      const total = byAsset.get(leg.asset) ?? 0n;
      byAsset.set(leg.asset, total + leg.amount);
    }
    for (const [asset, total] of byAsset.entries()) {
      if (total !== 0n) {
        throw new UnbalancedTransactionError(`Unbalanced asset ${asset}: ${total.toString()}`);
      }
    }

    // Insert all legs in one statement with ON CONFLICT DO NOTHING
    const txIds = tx.legs.map(() => tx.txId);
    const legIndices = tx.legs.map((_, i) => i);
    const accountIds = tx.legs.map((leg) => leg.accountId);
    const assets = tx.legs.map((leg) => leg.asset);
    const amounts = tx.legs.map((leg) => leg.amount.toString());
    const directions = tx.legs.map((leg) => (leg.amount < 0n ? "DEBIT" : "CREDIT"));
    const refEventIds = tx.legs.map(() => tx.refEventId);

    const result = await this.sql.query(
      `INSERT INTO ledger_entries (tx_id, leg_idx, account_id, asset, amount, direction, ref_event_id)
       SELECT * FROM UNNEST($1::text[], $2::int[], $3::text[], $4::text[], $5::bigint[], $6::text[], $7::text[])
       ON CONFLICT (tx_id, leg_idx) DO NOTHING`,
      [txIds, legIndices, accountIds, assets, amounts.map((a) => BigInt(a)), directions, refEventIds],
    );

    const inserted = result.rowCount ?? 0;
    if (inserted === tx.legs.length) {
      return { posted: true };
    }
    if (inserted === 0) {
      // All legs already exist; verify they match
      const existing = await this.sql.query(
        `SELECT leg_idx, account_id, asset, amount::text, direction FROM ledger_entries WHERE tx_id = $1 ORDER BY leg_idx`,
        [tx.txId],
      );

      if (existing.rows.length !== tx.legs.length) {
        throw new LedgerConflictError(`TX ${tx.txId} has ${existing.rows.length} legs, expected ${tx.legs.length}`);
      }

      for (let i = 0; i < existing.rows.length; i++) {
        const row = existing.rows[i]!;
        const leg = tx.legs[i]!;
        if (row.account_id !== leg.accountId || row.asset !== leg.asset || BigInt(row.amount) !== leg.amount) {
          throw new LedgerConflictError(`TX ${tx.txId} leg ${i} differs in content`);
        }
      }
      return { posted: false };
    }

    throw new LedgerConflictError(`TX ${tx.txId} partially inserted: ${inserted}/${tx.legs.length} legs`);
  }

  async loadAll(): Promise<readonly LedgerEntry[]> {
    const result = await this.sql.query(
      `SELECT tx_id, seq, account_id, asset, amount::text, direction, ref_event_id
       FROM ledger_entries ORDER BY seq`,
      [],
    );

    return result.rows.map((row) => ({
      txId: row.tx_id,
      seq: row.seq,
      accountId: row.account_id,
      asset: row.asset,
      amount: BigInt(row.amount),
      direction: row.direction,
      refEventId: row.ref_event_id,
    }));
  }
}
