import { it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { setUpIsolatedSchema } from "./test-schema.js";
import { runMigrations } from "./migrate.js";

it.skipIf(process.env.RUN_INTEGRATION !== "1")("MIG-LIVE: concurrent startup accepts byte-identical Week 11 renames without rerunning DDL", async () => {
  const directory = fileURLToPath(new URL("../migrations/", import.meta.url));
  const schema = await setUpIsolatedSchema(process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres", "migration_startup", directory);
  try {
    for (const [current, previous] of [["018_system_endpoints.sql", "017_system_endpoints.sql"], ["019_recovery_log.sql", "018_recovery_log.sql"], ["020_verify_replay_support.sql", "018_verify_replay_support.sql"]]) {
      await schema.pool.query("UPDATE schema_migrations SET filename=$1 WHERE filename=$2", [previous, current]);
    }
    await schema.pool.query("INSERT INTO journal(stream_id,seq,record_type,idx,schema_version,ts,writer_epoch,payload_json) VALUES('preserved',1,'COMMAND',0,1,1,1,'{}')");
    await Promise.all([runMigrations(schema.pool, directory), runMigrations(schema.pool, directory)]);
    expect((await schema.pool.query("SELECT count(*)::int n FROM journal WHERE stream_id='preserved'")).rows[0].n).toBe(1);
    expect((await schema.pool.query("SELECT count(*)::int n FROM schema_migrations WHERE filename='019_recovery_log.sql'")).rows[0].n).toBe(1);
    await schema.pool.query("UPDATE schema_migrations SET checksum='modified' WHERE filename='019_recovery_log.sql'");
    await expect(runMigrations(schema.pool, directory)).rejects.toThrow("has been modified");
  } finally { await schema.teardown(); }
});
