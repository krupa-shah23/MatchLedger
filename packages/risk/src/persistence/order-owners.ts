import type { SqlExecutor } from "@matchledger/journal";

export type OrderOwner = {
  orderId: string;
  accountId: string;
  symbol: string;
  side: "BUY" | "SELL";
};

export class OwnerConflictError extends Error {
  public constructor(message = "Order owner conflict: existing record differs") {
    super(message);
    this.name = "OwnerConflictError";
  }
}

export class OwnerMissingError extends Error {
  public constructor(orderId: string) {
    super(`Order owner missing for order ${orderId}`);
    this.name = "OwnerMissingError";
  }
}

export class OrderOwnerStore {
  public constructor(private readonly sql: SqlExecutor) {}

  async insertOwner(owner: OrderOwner): Promise<{ inserted: boolean }> {
    const result = await this.sql.query(
      `INSERT INTO order_owners (order_id, account_id, symbol, side)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (order_id) DO NOTHING`,
      [owner.orderId, owner.accountId, owner.symbol, owner.side],
    );

    if ((result.rowCount ?? 0) > 0) {
      return { inserted: true };
    }

    // Verify existing row matches
    const existing = await this.sql.query(`SELECT account_id, symbol, side FROM order_owners WHERE order_id = $1`, [
      owner.orderId,
    ]);

    if (existing.rows.length === 0) {
      throw new OwnerConflictError(`Order ${owner.orderId} disappeared after conflict`);
    }

    const row = existing.rows[0];
    if (row.account_id !== owner.accountId || row.symbol !== owner.symbol || row.side !== owner.side) {
      throw new OwnerConflictError(
        `Order ${owner.orderId} exists with different values: ${row.account_id}/${row.symbol}/${row.side}`,
      );
    }

    return { inserted: false };
  }

  async lookupMany(orderIds: readonly string[]): Promise<Map<string, OrderOwner>> {
    const result = new Map<string, OrderOwner>();
    if (orderIds.length === 0) return result;

    const chunks = [];
    for (let i = 0; i < orderIds.length; i += 1000) {
      chunks.push(orderIds.slice(i, i + 1000));
    }

    for (const chunk of chunks) {
      const rows = await this.sql.query(
        `SELECT order_id, account_id, symbol, side FROM order_owners WHERE order_id = ANY($1::text[])`,
        [chunk],
      );

      for (const row of rows.rows) {
        result.set(row.order_id, {
          orderId: row.order_id,
          accountId: row.account_id,
          symbol: row.symbol,
          side: row.side,
        });
      }
    }

    return result;
  }
}
