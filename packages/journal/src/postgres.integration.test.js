import { describe, expect, it } from "vitest";
import { verifyInt8RoundTrip } from "./index.js";
const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";
async function waitForPostgres(url, maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await verifyInt8RoundTrip(url, 1n);
            return;
        }
        catch {
            if (i < maxRetries - 1)
                await new Promise((r) => setTimeout(r, 500));
        }
    }
}
describe.skipIf(!run)("Spike 3: PostgreSQL int8", () => {
    it("round-trips bigint through the compose Postgres", async () => {
        const url = process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres";
        await waitForPostgres(url);
        expect(await verifyInt8RoundTrip(url, 9007199254740993n)).toBe(9007199254740993n);
    }, 60_000);
});
