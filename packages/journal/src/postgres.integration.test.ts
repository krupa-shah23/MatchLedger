import { describe, expect, it } from "vitest";
import { verifyInt8RoundTrip } from "./index.js";
const run = process.env.RUN_CONTAINERS === "1";
describe.skipIf(!run)("Spike 3: PostgreSQL int8", () => it("round-trips bigint through Testcontainers", async () => { const moduleName = "@testcontainers/postgresql"; const { PostgreSqlContainer } = await import(moduleName); const db = await new PostgreSqlContainer("postgres:18").start(); try { expect(await verifyInt8RoundTrip(db.getConnectionUri(), 9007199254740993n)).toBe(9007199254740993n); } finally { await db.stop(); } }, 60_000));
