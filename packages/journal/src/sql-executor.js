function wrapClient(client) {
    return {
        query: (sql, values) => client.query(sql, values),
        // Nested transaction calls on a tx executor reuse the same client/connection;
        // savepoints are not needed since nested commit/rollback is a no-op boundary
        // inside the already-open outer transaction.
        transaction: (fn) => fn(wrapClient(client)),
    };
}
export function createSqlExecutor(pool) {
    return {
        query: (sql, values) => pool.query(sql, values),
        transaction: async (fn) => {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                const result = await fn(wrapClient(client));
                await client.query("COMMIT");
                return result;
            }
            catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
            finally {
                client.release();
            }
        },
    };
}
