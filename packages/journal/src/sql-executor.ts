import type { Pool, PoolClient, QueryResult } from "pg";

export interface SqlExecutor {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

function wrapClient(client: PoolClient): SqlExecutor {
  return {
    query: (sql, values) => client.query(sql, values as unknown[] | undefined),
    // Nested transaction calls on a tx executor reuse the same client/connection;
    // savepoints are not needed since nested commit/rollback is a no-op boundary
    // inside the already-open outer transaction.
    transaction: (fn) => fn(wrapClient(client)),
  };
}

export function createSqlExecutor(pool: Pool): SqlExecutor {
  return {
    query: (sql, values) => pool.query(sql, values as unknown[] | undefined),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(wrapClient(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
