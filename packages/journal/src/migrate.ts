import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

export async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT NOT NULL PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const filepath = join(migrationsDir, filename);
    const sql = readFileSync(filepath, "utf-8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    const existing = await pool.query("SELECT checksum FROM schema_migrations WHERE filename = $1", [
      filename,
    ]);

    if (existing.rows.length > 0) {
      const storedChecksum = (existing.rows[0] as { checksum: string }).checksum;
      if (storedChecksum !== checksum) {
        throw new Error(`Migration ${filename} has been modified`);
      }
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [
        filename,
        checksum,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
