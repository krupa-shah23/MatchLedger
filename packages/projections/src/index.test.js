import { describe, it, expect } from "vitest";
import { createClient } from "redis";
import { encodeAndDecodeMoneyInMemory, storeAndLoadMoney } from "./index.js";
import { MAX_MONEY, MIN_MONEY } from "@matchledger/common";
const runIntegration = process.env.RUN_INTEGRATION === "1" || process.env.RUN_CONTAINERS === "1" || process.env.RUN_REDIS_SPIKE === "1";
describe("Spike 6: Redis money store/load", () => {
    it("encodes and decodes money in-memory without Redis", () => {
        const value = 9007199254740993n;
        expect(encodeAndDecodeMoneyInMemory(value)).toBe(value);
        expect(encodeAndDecodeMoneyInMemory(MIN_MONEY)).toBe(MIN_MONEY);
        expect(encodeAndDecodeMoneyInMemory(MAX_MONEY)).toBe(MAX_MONEY);
    });
    it("stores and loads money using a mock client in unit test", async () => {
        const store = new Map();
        const mockClient = {
            async set(k, v) { store.set(k, v); },
            async get(k) { return store.get(k) ?? null; }
        };
        const val = 9007199254740993n;
        const result = await storeAndLoadMoney(mockClient, "test:key", val);
        expect(result).toBe(val);
    });
    describe.skipIf(!runIntegration)("Live Redis integration test", () => {
        it("round-trips bigint through live Redis instance", async () => {
            const client = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
            await client.connect();
            try {
                const val = 9007199254740993n;
                const loaded = await storeAndLoadMoney(client, "test:money:spike6", val);
                expect(loaded).toBe(val);
            }
            finally {
                await client.disconnect();
            }
        }, 10_000);
    });
});
