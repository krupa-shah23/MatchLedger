import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

// Week 11 removed duplicate migration numbers. Preserve existing history and
// accept only byte-identical known renames; never rerun their non-idempotent DDL.
const renamedFrom = new Map([
  ["018_system_endpoints.sql", "017_system_endpoints.sql"],
  ["019_recovery_log.sql", "018_recovery_log.sql"],
  ["020_verify_replay_support.sql", "018_verify_replay_support.sql"],
]);

export async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  const client = await pool.connect();
  try {
    // API and multiple shards can start together against the same schema.
    await client.query("SELECT pg_advisory_lock(hashtext(current_schema()))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT NOT NULL PRIMARY KEY, checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const files = readdirSync(migrationsDir).filter(file => file.endsWith(".sql")).sort();
    for (const filename of files) {
      const sql = readFileSync(join(migrationsDir, filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>("SELECT checksum FROM schema_migrations WHERE filename=$1", [filename]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration ${filename} has been modified`);
        continue;
      }
      const previous = renamedFrom.get(filename);
      if (previous) {
        const old = await client.query<{ checksum: string }>("SELECT checksum FROM schema_migrations WHERE filename=$1", [previous]);
        if (old.rows[0]) {
          if (old.rows[0].checksum !== checksum) throw new Error(`Renamed migration ${filename} differs from ${previous}`);
          await client.query("INSERT INTO schema_migrations(filename,checksum) VALUES($1,$2)", [filename, checksum]);
          continue;
        }
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(filename,checksum) VALUES($1,$2)", [filename, checksum]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    }
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(hashtext(current_schema()))"); }
    finally { client.release(); }
  }
}
