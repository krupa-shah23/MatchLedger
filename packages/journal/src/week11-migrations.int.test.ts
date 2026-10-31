import { describe, it, expect } from "vitest";
import { Client } from "pg";
import { mkdtempSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { uniqueSchemaName, withSchema } from "./test-schema.js";

const enabled = process.env.RUN_INTEGRATION === "1" || process.env.RUN_CONTAINERS === "1";
const url = process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres";
const migrations = fileURLToPath(new URL("../migrations/", import.meta.url));

describe.skipIf(!enabled)("Week 11 real database upgrades", () => {
  for (const from016 of [false, true]) {
    it(`MIG11: migrations 017/018 apply ${from016 ? "after 016" : "to a clean schema"}`, async () => {
      const schema = uniqueSchemaName("week11_migrate");
      const admin = new Client({ connectionString: url });
      await admin.connect();
      await admin.query(`CREATE SCHEMA ${schema}`);
      const pool = createPool({ connectionString: withSchema(url, schema) });
      const stage = mkdtempSync(join(tmpdir(), "ml-migrations-"));
      try {
        if (from016) {
          for (const filename of readdirSync(migrations).filter(n => /^\d+.*\.sql$/.test(n) && +n.slice(0, 3) <= 16)) {
            copyFileSync(join(migrations, filename), join(stage, filename));
          }
          await runMigrations(pool, stage);
          expect((await pool.query("SELECT COUNT(*)::int AS n FROM schema_migrations")).rows[0].n).toBe(16);
        }
        await runMigrations(pool, migrations);
        const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'shard_heartbeats'", [schema]);
        expect(columns.rows.map(r => r.column_name)).toEqual(expect.arrayContaining([
          "lease_id", "last_heartbeat_at", "last_seq", "owned_symbols", "updated_at",
        ]));
        await pool.query("INSERT INTO shard_heartbeats (lease_id, owned_symbols) VALUES ($1, $2)", ["probe", ["ACME"]]);
        const row = (await pool.query("SELECT owned_symbols FROM shard_heartbeats WHERE lease_id = $1", ["probe"])).rows[0];
        expect(row.owned_symbols).toEqual(["ACME"]);
        const before = (await pool.query("SELECT COUNT(*)::int AS n FROM schema_migrations")).rows[0].n;
        await runMigrations(pool, migrations);
        expect((await pool.query("SELECT COUNT(*)::int AS n FROM schema_migrations")).rows[0].n).toBe(before);
      } finally {
        await pool.end();
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
        rmSync(stage, { recursive: true, force: true });
      }
    });
  }
});
