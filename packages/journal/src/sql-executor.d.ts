import type { Pool, QueryResult } from "pg";
export interface SqlExecutor {
    query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
    transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
export declare function createSqlExecutor(pool: Pool): SqlExecutor;
