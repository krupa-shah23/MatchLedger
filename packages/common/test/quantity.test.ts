import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseQuantity } from "../src/quantity.js";

describe("parseQuantity", () => {
  it("Q1 accepts valid small integers as numbers and canonical strings", () => {
    expect(parseQuantity(1, 100n)).toEqual({ ok: true, value: 1n });
    expect(parseQuantity("1", 100n)).toEqual({ ok: true, value: 1n });
    expect(parseQuantity(100, 100n)).toEqual({ ok: true, value: 100n });
    expect(parseQuantity("100", 100n)).toEqual({ ok: true, value: 100n });
  });

  it("Q2 accepts Number.MAX_SAFE_INTEGER and applies the maximum", () => {
    const safe = BigInt(Number.MAX_SAFE_INTEGER);
    expect(parseQuantity(Number.MAX_SAFE_INTEGER, safe)).toEqual({ ok: true, value: safe });
    expect(parseQuantity(Number.MAX_SAFE_INTEGER, safe - 1n)).toEqual({ ok: false, error: "ABOVE_MAXIMUM" });
  });

  it("Q3 rejects unsafe integer-valued numbers before maximum checks", () => {
    expect(parseQuantity(2 ** 53, 2n ** 100n)).toEqual({ ok: false, error: "UNSAFE_INTEGER" });
    expect(parseQuantity(2 ** 60, 2n ** 100n)).toEqual({ ok: false, error: "UNSAFE_INTEGER" });
  });

  it("Q4 preserves exact large values supplied as strings", () => {
    expect(parseQuantity("9007199254740993", 9007199254740993n)).toEqual({ ok: true, value: 9007199254740993n });
    // The number literal has already rounded before parseQuantity receives it.
    expect(9007199254740993).toBe(9007199254740992);
  });

  it("Q5 rejects invalid number quantities", () => {
    for (const input of [NaN, Infinity, -Infinity, 1.5, -1, 0, -0]) {
      expect(parseQuantity(input, 100n)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    }
  });

  it("Q6 rejects non-canonical quantity strings", () => {
    for (const input of ["1e3", "0x10", "007", " 5", "5 ", "", "+5", "-1", "1.5", "1.0", "0", "٣"]) {
      expect(parseQuantity(input, 100000n)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    }
  });

  it("Q7 rejects non-number and non-string inputs", () => {
    for (const input of [null, undefined, true, {}, [], 5n]) {
      expect(parseQuantity(input, 100n)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    }
  });

  it("Q8 reports values above the maximum for numbers and strings", () => {
    expect(parseQuantity(101, 100n)).toEqual({ ok: false, error: "ABOVE_MAXIMUM" });
    expect(parseQuantity("101", 100n)).toEqual({ ok: false, error: "ABOVE_MAXIMUM" });
  });

  it("Q8b round-trips bigint values through their canonical strings and safe numbers", () => {
    const max = 2n ** 100n;
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max }), (value) => {
        expect(parseQuantity(value.toString(), max)).toEqual({ ok: true, value });
        if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
          expect(parseQuantity(Number(value), max)).toEqual({ ok: true, value });
        }
      }),
      { numRuns: 1_000 },
    );
  });
});
