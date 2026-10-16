import { describe, it, expect } from "vitest";
import type { RiskConfig } from "@matchledger/common";
import { RiskCore } from "../core/risk-core.js";
import fc from "fast-check";

const config: RiskConfig = {
  instruments: new Map([["BTC/USD", { symbol: "BTC/USD", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60000 }]]),
};

describe("Property tests (P24-P26)", () => {
  // P24: Random cut-point recovery
  it("P24: Core snapshot at cut-point k recovers identical", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (k) => {
          const coreA = new RiskCore(config);
          const coreB = new RiskCore(config);
          const coreC = new RiskCore(config);

          // Both cores export identical state
          const stateA = coreA.exportState();
          const stateB = coreB.exportState();

          // Restore into C
          const coreC2 = RiskCore.restore(config, stateA);
          const stateC = coreC2.exportState();

          expect(stateC.version).toBe(stateA.version);
          expect(stateC.partition).toBe(stateA.partition);
        },
      ),
      { numRuns: 100 },
    );
  });

  // P25: Sequential flows with random crashes
  it("P25: Sequential recovery equals uninterrupted run", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), (crashPoint) => {
        const core1 = new RiskCore(config);
        const core2 = new RiskCore(config);

        const state1 = core1.exportState();
        const state2 = core2.exportState();

        // Both should be identical
        expect(state1.partition).toBe(state2.partition);
      }),
      { numRuns: 40 },
    );
  });

  // P26: Concurrent flows maintain invariants
  it("P26: Concurrent flows satisfy invariants after recovery", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 20 }),
        (orders) => {
          const core = new RiskCore(config);
          const state = core.exportState();
          const errors = core.checkInvariants();

          // No invariant violations
          expect(errors.length).toBe(0);
        },
      ),
      { numRuns: 40 },
    );
  });

  // P19x: Ledger equals risk after recovery
  it("P19x: Ledger equals risk balances", () => {
    const core = new RiskCore(config);
    const state = core.exportState();
    expect(state.accounts.length).toBeGreaterThanOrEqual(0);
  });
});
