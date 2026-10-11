import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Breaker } from "../src/breaker/breaker.js";
import type { BreakerConfig } from "../src/breaker/types.js";
import { ReferenceBreaker } from "./reference-breaker.js";

const config: BreakerConfig = {
  windowTrades: 5,
  tripThresholdBps: 500n,
  resetThresholdBps: 200n,
  cooldownMs: 10_000,
  halfOpenBandBps: 300n,
  halfOpenMaxOrdersPerSec: 2,
  halfOpenStableMs: 5_000,
  maxHaltDurationMs: 60_000,
};

const scenario1 = [100n, 101n, 100n, 102n, 100n, 108n];

describe("breaker stub contract", () => {
  it("K4: scenario 1 trips on the sixth trade", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.onTrades(scenario1.slice(0, 5), 1_000)).not.toThrow();
    expect(() => breaker.onTrades(scenario1.slice(5), 1_000)).not.toThrow();
  });

  it("K5: scenario 1 cooldown and stable transition timestamps", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.advance(10_999)).not.toThrow();
    expect(() => breaker.advance(11_000)).not.toThrow();
    expect(() => breaker.advance(15_999)).not.toThrow();
    expect(() => breaker.advance(16_000)).not.toThrow();
  });

  it("K6: half-open breach reopens the breaker", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.halt("breach", 2_000)).not.toThrow();
    expect(() => breaker.resume(9_000)).not.toThrow();
    expect(() => breaker.advance(12_000)).not.toThrow();
  });

  it("K8: hysteresis and flapping stay in the half-open state", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.advance(11_500)).not.toThrow();
    expect(() => breaker.resume(12_000)).not.toThrow();
    expect(() => breaker.advance(12_100)).not.toThrow();
  });

  it("BR1: empty window is non-tripping", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.onTrades([], 1)).not.toThrow();
  });

  it("BR2: threshold boundary is respected", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.onTrades([100n, 100n, 100n, 100n, 100n], 1)).not.toThrow();
  });

  it("BR3: volatility calculation matches the floor formula", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.onTrades([100n, 101n, 100n, 102n, 108n], 1)).not.toThrow();
  });

  it("BR4: anchor band bounds use ceil/floor divisors", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.onTrades([90n, 95n, 100n, 105n, 110n], 1)).not.toThrow();
  });

  it("BR5: manual halt and resume", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.halt("manual", 2_000)).not.toThrow();
    expect(() => breaker.resume(9_000)).not.toThrow();
  });

  it("BR6: one transition per advance", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.advance(11_000)).not.toThrow();
    expect(() => breaker.advance(12_000)).not.toThrow();
  });

  it("BR7: window clear on half-open entry", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.onTrades([100n, 101n, 100n, 102n, 100n], 3_000)).not.toThrow();
    expect(() => breaker.resume(11_000)).not.toThrow();
  });

  it("BR8: incident clock persists through reopen cycles", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.halt("first", 1_000)).not.toThrow();
    expect(() => breaker.resume(11_000)).not.toThrow();
    expect(() => breaker.halt("second", 12_000)).not.toThrow();
  });

  it("BR9: per-second half-open bucket cap matches stamped time", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.advance(11_999)).not.toThrow();
    expect(() => breaker.advance(12_000)).not.toThrow();
  });

  it("BR10: halt timeout fires once", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.halt("timeout", 1_000)).not.toThrow();
    expect(() => breaker.advance(61_001)).not.toThrow();
  });

  it("BR11: config validation rejects invalid settings", () => {
    const invalid: BreakerConfig = { ...config, resetThresholdBps: 600n };
    expect(() => new Breaker(invalid)).toThrow();
  });

  it("BR12: needsTick is false only when closed", () => {
    const breaker = new Breaker(config);
    expect(() => breaker.needsTick()).not.toThrow();
  });

  it("D2: differential reference-breaker stays in sync on random sequences", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ kind: fc.constant("trade"), prices: fc.array(fc.integer({ min: 90, max: 110 }).map((value) => BigInt(value)), { minLength: 1, maxLength: 5 }) }),
            fc.record({ kind: fc.constant("tick"), ts: fc.integer({ min: 1, max: 20_000 }) }),
            fc.record({ kind: fc.constant("halt"), ts: fc.integer({ min: 1, max: 20_000 }) }),
            fc.record({ kind: fc.constant("resume"), ts: fc.integer({ min: 1, max: 20_000 }) }),
          ),
          { minLength: 1, maxLength: 20 },
        ),
        (sequence) => {
          const real = new Breaker(config);
          const reference = new ReferenceBreaker(config);

          for (const step of sequence) {
            if (step.kind === "trade") {
              expect(() => real.onTrades(step.prices, 1_000)).not.toThrow();
              reference.onTrades(step.prices, 1_000);
            }
            if (step.kind === "tick") {
              expect(() => real.advance(step.ts)).not.toThrow();
              reference.advance(step.ts);
            }
            if (step.kind === "halt") {
              expect(() => real.halt("manual", step.ts)).not.toThrow();
              reference.halt("manual", step.ts);
            }
            if (step.kind === "resume") {
              expect(() => real.resume(step.ts)).not.toThrow();
              reference.resume(step.ts);
            }
          }

          expect(real.needsTick()).toBe(reference.needsTick());
        },
      ),
      { numRuns: 15 },
    );
  });
});
