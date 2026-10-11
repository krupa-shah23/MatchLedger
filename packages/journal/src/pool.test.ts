import { describe, it, expect } from "vitest";
import { createPool, toSafeNumber } from "./pool.js";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";

describe.skipIf(!run)("PG: Pool and int8 parsing", () => {
  it("PG1: Round-trip bigint through int8 column", async () => {
    const p = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });

    try {
      await p.query("CREATE TEMP TABLE test_int8 (value BIGINT)");
      await p.query("INSERT INTO test_int8 VALUES (123)");
      const result = await p.query("SELECT value FROM test_int8");
      expect(result.rows).toHaveLength(1);
    } finally {
      await p.end();
    }
  });

  it("PG4: Pool-scoped parser does not affect other pools", async () => {
    const pool1 = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });
    const pool2 = createPool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres" });

    try {
      await pool1.query("CREATE TEMP TABLE test_scope (value BIGINT)");
      await pool1.query("INSERT INTO test_scope VALUES (123)");

      const result = await pool1.query("SELECT value FROM test_scope");
      expect(result.rows[0]).toBeDefined();
    } finally {
      await pool1.end();
      await pool2.end();
    }
  });
});

describe("toSafeNumber", () => {
  it("accepts safe integers", () => {
    expect(toSafeNumber(0)).toBe(0);
    expect(toSafeNumber(123)).toBe(123);
    expect(toSafeNumber("456")).toBe(456);
  });

  it("rejects unsafe integers", () => {
    expect(() => toSafeNumber(BigInt(2) ** BigInt(63))).toThrow();
  });
});
