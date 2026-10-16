import { Client, Pool } from "pg";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrate.js";
/** Builds a connection string that pins search_path to a unique schema via the
 * Postgres startup `options` parameter. This is set before the connection is
 * usable (not a query run after connect), so it is race-free across every
 * connection the pool opens -- unlike a `SET search_path` issued inside a
 * 'connect' event handler, which the pool does not wait on. */
export function withSchema(baseConnectionString, schema) {
    const url = new URL(baseConnectionString);
    url.searchParams.set("options", `-c search_path=${schema}`);
    return url.toString();
}
let counter = 0;
/** Deterministic unique schema name: process pid + an in-process monotonic
 * counter, so test files running concurrently never collide, without any
 * Math.random. */
export function uniqueSchemaName(prefix) {
    counter += 1;
    return `${prefix}_${process.pid}_${counter}`;
}
/** Creates a brand-new Postgres schema, runs the journal migrations inside it,
 * and returns a Pool whose every connection is pinned to that schema. One
 * instance per test FILE (not per test case) keeps each file's integration
 * tests isolated from every other file running concurrently. */
export async function setUpIsolatedSchema(baseConnectionString, schemaPrefix, migrationsDir) {
    const schema = uniqueSchemaName(schemaPrefix);
    const bootstrap = new Client({ connectionString: baseConnectionString });
    await bootstrap.connect();
    await bootstrap.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await bootstrap.query(`CREATE SCHEMA ${schema}`);
    await bootstrap.end();
    const pool = createPool({ connectionString: withSchema(baseConnectionString, schema) });
    await runMigrations(pool, migrationsDir);
    return {
        pool,
        schema,
        teardown: async () => {
            await pool.end();
            const cleanup = new Client({ connectionString: baseConnectionString });
            await cleanup.connect();
            await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await cleanup.end();
        },
    };
}
