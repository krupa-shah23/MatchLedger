/**
 * Read-only queries from projection tables.
 * All reads from projections, never from the engine.
 */

export interface SqlExecutor {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}

export async function getOrder(
  executor: SqlExecutor,
  orderId: string
): Promise<Record<string, unknown> | null> {
  const result = await executor.query(
    "SELECT * FROM orders_view WHERE order_id = $1;",
    [orderId]
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ?? null;
}

export async function listOrders(
  executor: SqlExecutor,
  accountId: string,
  limit: number = 50,
  cursor?: string
): Promise<{ orders: Record<string, unknown>[]; nextCursor: string | null }> {
  // Cursor is base64(created_at || order_id)
  const params: unknown[] = [accountId];
  if (cursor) {
    const [ts, id] = decodeCursor(cursor);
    params.push(ts, id);
  }
  params.push(limit + 1);

  const result = await executor.query(
    `SELECT * FROM orders_view
     WHERE account_id = $1 ${cursor ? "AND (created_at, order_id) < ($2, $3)" : ""}
     ORDER BY created_at DESC, order_id DESC
     LIMIT $${cursor ? 4 : 2};`,
    params
  );

  const orders = result.rows.slice(0, limit) as Record<string, unknown>[];
  const hasMore = result.rows.length > limit;
  const lastOrder = orders[orders.length - 1];
  const nextCursor = hasMore && lastOrder ? encodeCursor(lastOrder) : null;

  return { orders, nextCursor };
}

function decodeCursor(cursor: string): [string, string] {
  const parts = Buffer.from(cursor, "base64").toString().split("|");
  return [parts[0] ?? "", parts[1] ?? ""];
}

function encodeCursor(row: Record<string, unknown>): string {
  const cursor = `${String(row.created_at ?? "")}|${String(row.order_id ?? "")}`;
  return Buffer.from(cursor).toString("base64");
}

export async function getOrderTimeline(
  executor: SqlExecutor,
  orderId: string
): Promise<Record<string, unknown>[]> {
  // Merge risk and engine events ordered by (ts, stage_rank, seq)
  const result = await executor.query(
    `SELECT * FROM (
       SELECT ts, 1 as stage_rank, seq, 'RISK_COMMAND' as source FROM risk_commands WHERE order_id = $1
       UNION ALL
       SELECT ts, 2 as stage_rank, seq, 'RISK_EVENT' as source FROM risk_events WHERE order_id = $1
       UNION ALL
       SELECT ts, 3 as stage_rank, seq, 'ENGINE' as source FROM engine_events WHERE order_id = $1
     ) timeline
     ORDER BY ts, stage_rank, seq;`,
    [orderId]
  );
  return result.rows as Record<string, unknown>[];
}

export async function getBook(
  executor: SqlExecutor,
  symbol: string
): Promise<Record<string, unknown>> {
  const result = await executor.query(
    `SELECT side, price, remaining as quantity FROM resting_orders
     WHERE symbol = $1 AND side = 'BUY'
     ORDER BY price DESC, order_id
     LIMIT 10`,
    [symbol]
  );
  const bid = result.rows;

  const ask = await executor.query(
    `SELECT side, price, remaining as quantity FROM resting_orders
     WHERE symbol = $1 AND side = 'SELL'
     ORDER BY price ASC, order_id
     LIMIT 10`,
    [symbol]
  );

  return { symbol, bid, ask, seq: 0 };
}

export async function getTrades(
  executor: SqlExecutor,
  symbol: string,
  limit: number = 20
): Promise<Record<string, unknown>[]> {
  const result = await executor.query(
    `SELECT * FROM trades_view WHERE symbol = $1
     ORDER BY engine_seq DESC, idx DESC
     LIMIT $2;`,
    [symbol, limit]
  );
  return result.rows as Record<string, unknown>[];
}

export async function getBalances(
  executor: SqlExecutor,
  accountId: string
): Promise<Record<string, unknown> | null> {
  const result = await executor.query(
    "SELECT account_id, cash, held_cash FROM balances_view WHERE account_id = $1;",
    [accountId]
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ?? null;
}

export async function getPositions(
  executor: SqlExecutor,
  accountId: string
): Promise<Record<string, unknown>[]> {
  const result = await executor.query(
    `SELECT symbol, quantity, held_shares, cost_basis, realized_pnl
     FROM positions_view WHERE account_id = $1;`,
    [accountId]
  );
  return result.rows as Record<string, unknown>[];
}

export async function getPnl(
  executor: SqlExecutor,
  accountId: string
): Promise<Record<string, unknown>[]> {
  const result = await executor.query(
    `SELECT symbol, quantity, cost_basis, realized_pnl FROM positions_view
     WHERE account_id = $1;`,
    [accountId]
  );
  return result.rows as Record<string, unknown>[];
}

export async function getReservations(
  executor: SqlExecutor,
  accountId: string
): Promise<Record<string, unknown>[]> {
  const result = await executor.query(
    `SELECT * FROM reservations_view WHERE account_id = $1;`,
    [accountId]
  );
  return result.rows as Record<string, unknown>[];
}

export async function getRejections(
  executor: SqlExecutor,
  limit: number = 50
): Promise<Record<string, unknown>[]> {
  const result = await executor.query(
    `SELECT * FROM rejections_view ORDER BY ts DESC LIMIT $1;`,
    [limit]
  );
  return result.rows as Record<string, unknown>[];
}

export async function getBreakers(
  executor: SqlExecutor
): Promise<Record<string, unknown>[]> {
  const result = await executor.query(
    `SELECT * FROM breaker_view;`,
    []
  );
  return result.rows as Record<string, unknown>[];
}
