import { Client, types } from "pg";
types.setTypeParser(20, (value) => BigInt(value));

export * from "./recovery.js";
export { createPool, toSafeNumber } from "./pool.js";
export { runMigrations } from "./migrate.js";
export { PgJournal, JournalSequenceError, JournalConflictError } from "./pg-journal.js";
export { PgSnapshotStore } from "./snapshot-store.js";
export { OrderRequestStore } from "./order-request-store.js";

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
