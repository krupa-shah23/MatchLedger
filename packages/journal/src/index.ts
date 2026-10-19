import { Client, types } from "pg";
types.setTypeParser(20, (value) => BigInt(value));

export * from "./recovery.js";
export { createPool, toSafeNumber } from "./pool.js";
export { runMigrations } from "./migrate.js";
export { PgJournal, JournalSequenceError, JournalConflictError } from "./pg-journal.js";
export { PgSnapshotStore } from "./snapshot-store.js";
export { OrderRequestStore } from "./order-request-store.js";
export { createSqlExecutor } from "./sql-executor.js";
export type { SqlExecutor } from "./sql-executor.js";
export { LeaseStore } from "./lease-store.js";
export { FencedPgJournal, FencedWriterError } from "./fenced-pg-journal.js";
export type { OffsetTicket } from "./fenced-pg-journal.js";
export { setUpIsolatedSchema, withSchema, uniqueSchemaName } from "./test-schema.js";
export type { IsolatedSchema } from "./test-schema.js";

export async function verifyInt8RoundTrip(connectionString: string, value: bigint): Promise<bigint> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ value: bigint }>("SELECT $1::bigint AS value", [value.toString()]);
    return result.rows[0]!.value;
  } finally {
    await client.end();
  }
}
