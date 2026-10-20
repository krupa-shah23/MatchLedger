import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const migrationsDir = join(__dirname, "..", "migrations");

describe.skipIf(!run)("MG: Migrations", () => {
  let pool: ReturnType<typeof createPool>;

  beforeEach(async () => {
    pool = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
    // Drop all tables and projections to start fresh
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
  });

  it("MG1: Migrations apply in order and are idempotent", async () => {
    await runMigrations(pool, migrationsDir);

    const result = await pool.query("SELECT COUNT(*) as count FROM schema_migrations");
    const count = (result.rows[0] as any)?.count ?? 0;
    expect(count).toBeGreaterThan(0);

    const journalExists = await pool.query("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'journal')");
    expect((journalExists.rows[0] as any).exists).toBe(true);

    const snapshotsExists = await pool.query("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'snapshots')");
    expect((snapshotsExists.rows[0] as any).exists).toBe(true);

    await runMigrations(pool, migrationsDir);
    const result2 = await pool.query("SELECT COUNT(*) as count FROM schema_migrations");
    const count2 = (result2.rows[0] as any)?.count ?? 0;
    expect(count2).toBe(count);
  });

  it("MG3: Modified migration file causes checksum error", async () => {
    await runMigrations(pool, migrationsDir);

    await expect(async () => {
      await pool.query(
        "UPDATE schema_migrations SET checksum = 'badhash' WHERE filename = '001_journal.sql'",
      );
      await runMigrations(pool, migrationsDir);
    }).rejects.toThrow("has been modified");
  });

  afterEach(async () => {
    if (pool) await pool.end();
  });
});
