import type { SqlExecutor } from "./sql-executor.js";

export class LeaseStore {
  constructor(private sql: SqlExecutor) {}

  async acquire(leaseId: string, owner: string): Promise<bigint> {
    return await this.sql.transaction(async (tx) => {
      // Insert row at epoch 0 if missing, then atomically increment
      await tx.query(
        `INSERT INTO shard_leases (lease_id, owner, epoch)
         VALUES ($1, $2, 0)
         ON CONFLICT (lease_id) DO NOTHING`,
        [leaseId, owner]
      );

      // Atomically increment epoch and return new value
      const result = await tx.query(
        `UPDATE shard_leases
         SET epoch = epoch + 1, owner = $2, acquired_at = now()
         WHERE lease_id = $1
         RETURNING epoch`,
        [leaseId, owner]
      );

      if (result.rows.length === 0) {
        throw new Error(`Failed to acquire lease: ${leaseId}`);
      }

      return BigInt(String(result.rows[0]!.epoch));
    });
  }

  async current(leaseId: string): Promise<bigint | null> {
    const result = await this.sql.query(
      `SELECT epoch FROM shard_leases WHERE lease_id = $1`,
      [leaseId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return BigInt(String(result.rows[0]!.epoch));
  }
}
