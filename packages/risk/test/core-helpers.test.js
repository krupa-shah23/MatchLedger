import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { MAX_AMOUNT, ceilDiv, ceilToTick, floorDiv, floorToTick, notional } from "../src/core/money.js";
import { computeMarketLimit, resolveReference } from "../src/core/reference.js";
const cfg = {
    symbol: "ABC",
    tickSize: 5n,
    maxPrice: 50000n,
    protectionBandBps: 100n,
    maxBandBps: 500n,
    referencePriceTicks: 10050n,
    maxReferenceAgeMs: 60_000,
};
describe("money helpers", () => {
    it("rejects non-positive and overflow values", () => {
        expect(() => notional(10n, 0n)).toThrow(RangeError);
        expect(() => notional(0n, 10n)).toThrow(RangeError);
        expect(notional(10n, 20n)).toBe(200n);
        expect(notional(MAX_AMOUNT, 1n)).toBe(MAX_AMOUNT);
        expect(() => notional(MAX_AMOUNT + 1n, 1n)).toThrow(RangeError);
    });
    it("calculates exact ceiling and floor division", () => {
        expect(ceilDiv(10n, 3n)).toBe(4n);
        expect(floorDiv(10n, 3n)).toBe(3n);
        expect(ceilToTick(10n, 5n)).toBe(10n);
        expect(floorToTick(12n, 5n)).toBe(10n);
    });
    it("keeps tick rounding within the expected bounds", () => {
        fc.assert(fc.property(fc.bigInt({ min: 1n, max: 10000n }), fc.bigInt({ min: 1n, max: 25n }), (value, tick) => {
            const floored = floorToTick(value, tick);
            const ceiled = ceilToTick(value, tick);
            expect(floored).toBeLessThanOrEqual(value);
            expect(ceiled).toBeGreaterThanOrEqual(value);
            expect(floored % tick).toBe(0n);
            expect(ceiled % tick).toBe(0n);
        }), { numRuns: 200 });
    });
});
describe("reference helpers", () => {
    it("MO1: last trade wins over midpoint, which wins over static", () => {
        const last = resolveReference({ lastTradePrice: 120n, lastTradeTs: 100, bestBid: 90n, bestAsk: 110n }, 110, cfg);
        expect(last).toEqual({ price: 120n, source: "LAST_TRADE" });
        const midpoint = resolveReference({ lastTradePrice: 120n, lastTradeTs: 0, bestBid: 90n, bestAsk: 110n }, 120_000, cfg);
        expect(midpoint).toEqual({ price: 100n, source: "MIDPOINT" });
        const staticResult = resolveReference({ bestBid: undefined, bestAsk: undefined }, 10_000, cfg);
        expect(staticResult).toEqual({ price: 10050n, source: "STATIC" });
    });
    it("MO2: stale last trade falls back to midpoint", () => {
        const value = resolveReference({ lastTradePrice: 120n, lastTradeTs: 0, bestBid: 90n, bestAsk: 110n }, 120_000, cfg);
        expect(value).toEqual({ price: 100n, source: "MIDPOINT" });
    });
    it("MO3: one-sided book and no reference return undefined/static as expected", () => {
        expect(resolveReference({ bestBid: 100n, bestAsk: undefined }, 10_000, cfg)).toEqual({ price: 10050n, source: "STATIC" });
        expect(resolveReference({}, 10_000, { ...cfg, referencePriceTicks: undefined })).toBeUndefined();
    });
    it("MO4: rounding vectors and exact multiples", () => {
        expect(computeMarketLimit("BUY", 10050n, cfg)).toBe(10155n);
        expect(computeMarketLimit("SELL", 10050n, cfg)).toBe(9945n);
        expect(computeMarketLimit("BUY", 10000n, { ...cfg, protectionBandBps: 0n })).toBe(10000n);
        expect(computeMarketLimit("SELL", 10000n, { ...cfg, protectionBandBps: 0n })).toBe(10000n);
    });
    it("MO5: effective band honors maxBandBps", () => {
        expect(computeMarketLimit("BUY", 100n, { ...cfg, protectionBandBps: 800n, maxBandBps: 500n })).toBe(105n);
        expect(() => computeMarketLimit("BUY", 100n, { ...cfg, protectionBandBps: 10000n, maxBandBps: 500n })).toThrow(RangeError);
        expect(() => computeMarketLimit("BUY", 100n, { ...cfg, protectionBandBps: -1n, maxBandBps: 500n })).toThrow(RangeError);
    });
    it("MO6: SELL floor and BUY cap clamp", () => {
        expect(computeMarketLimit("SELL", 5n, { ...cfg, protectionBandBps: 9999n, maxBandBps: 9999n })).toBe(5n);
        expect(computeMarketLimit("BUY", 10000n, { ...cfg, maxPrice: 10100n, protectionBandBps: 200n, maxBandBps: 500n })).toBe(10100n);
    });
    it("MO8: midpoint calculation uses floor division", () => {
        expect(resolveReference({ bestBid: 100n, bestAsk: 101n }, 0, cfg)).toEqual({ price: 100n, source: "MIDPOINT" });
        expect(resolveReference({ bestBid: 100n, bestAsk: 102n }, 0, cfg)).toEqual({ price: 101n, source: "MIDPOINT" });
    });
});
