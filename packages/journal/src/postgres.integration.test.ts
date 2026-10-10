import { describe, expect, it } from "vitest";
import { verifyInt8RoundTrip } from "./index.js";

const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";

describe.skipIf(!run)("Spike 3: PostgreSQL int8", () => {
  it("round-trips bigint through the compose Postgres", async () => {
    const url = process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres";
    expect(await verifyInt8RoundTrip(url, 9007199254740993n)).toBe(9007199254740993n);
  }, 60_000);
});
