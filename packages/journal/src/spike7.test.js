import { describe, it, expect } from "vitest";
import { encodeMoney, decodeMoney, MIN_MONEY, MAX_MONEY } from "@matchledger/common";
import { verifyInt8RoundTrip } from "./index.js";
import { createClient } from "redis";
const runIntegration = process.env.RUN_INTEGRATION === "1" || process.env.RUN_CONTAINERS === "1";
describe("Spike 7: End-to-end Money codec, JSON, Postgres int8, and Redis chain", () => {
    const testValues = [
        9007199254740993n, // > Number.MAX_SAFE_INTEGER
        MIN_MONEY, // Negative boundary (-10^18)
        MAX_MONEY, // Positive boundary (10^18)
        0n,
        -9007199254740993n
    ];
    it("chains bigint through money codec and JSON string round-trip in-memory", () => {
        for (const original of testValues) {
            const encoded = encodeMoney(original);
            const jsonStr = JSON.stringify({ amount: encoded });
            const parsedObj = JSON.parse(jsonStr);
            const decoded = decodeMoney(parsedObj.amount);
            expect(decoded).toBe(original);
        }
    });
    describe.skipIf(!runIntegration)("Opt-in live Postgres and Redis full chain integration test", () => {
        it("chains bigint through JSON, Postgres int8, and Redis", async () => {
            const pgConnectionString = process.env.DATABASE_URL ?? "postgres://postgres:matchledger@localhost:5432/postgres";
            const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
            const redisClient = createClient({ url: redisUrl });
            await redisClient.connect();
            try {
                for (const original of testValues) {
                    // Step 1: Codec to JSON string
                    const encodedStr = encodeMoney(original);
                    const jsonPayload = JSON.stringify({ money: encodedStr });
                    const parsedPayload = JSON.parse(jsonPayload);
                    const fromJson = decodeMoney(parsedPayload.money);
                    expect(fromJson).toBe(original);
                    // Step 2: Pass through Postgres int8 parser
                    const fromPg = await verifyInt8RoundTrip(pgConnectionString, fromJson);
                    expect(fromPg).toBe(original);
                    // Step 3: Pass through Redis storage
                    const redisKey = `spike7:test:${original.toString()}`;
                    await redisClient.set(redisKey, encodeMoney(fromPg));
                    const rawRedis = await redisClient.get(redisKey);
                    expect(rawRedis).not.toBeNull();
                    const finalVal = decodeMoney(rawRedis);
                    expect(finalVal).toBe(original);
                }
            }
            finally {
                await redisClient.disconnect();
            }
        }, 30_000);
    });
});
