import { Pool } from "pg";
/** Builds a connection string that pins search_path to a unique schema via the
 * Postgres startup `options` parameter. This is set before the connection is
 * usable (not a query run after connect), so it is race-free across every
 * connection the pool opens -- unlike a `SET search_path` issued inside a
 * 'connect' event handler, which the pool does not wait on. */
export declare function withSchema(baseConnectionString: string, schema: string): string;
/** Deterministic unique schema name: process pid + an in-process monotonic
 * counter, so test files running concurrently never collide, without any
 * Math.random. */
export declare function uniqueSchemaName(prefix: string): string;
export interface IsolatedSchema {
    pool: Pool;
    schema: string;
    teardown: () => Promise<void>;
}
/** Creates a brand-new Postgres schema, runs the journal migrations inside it,
 * and returns a Pool whose every connection is pinned to that schema. One
 * instance per test FILE (not per test case) keeps each file's integration
 * tests isolated from every other file running concurrently. */
export declare function setUpIsolatedSchema(baseConnectionString: string, schemaPrefix: string, migrationsDir: string): Promise<IsolatedSchema>;
