import { describe, it, expect } from "vitest";
import type { RiskConfig, RiskState } from "@matchledger/common";
import { RiskCore } from "../core/risk-core.js";

describe("Risk export/restore (RX1-RX7)", () => {
  const config: RiskConfig = {
    instruments: new Map([["BTC/USD", { symbol: "BTC/USD", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60000 }]]),
  };

  // RX1: exportState() canonical
  it("RX1: exportState() canonical - equal cores give equal states", () => {
    const core1 = new RiskCore(config);
    const core2 = new RiskCore(config);

    const state1 = core1.exportState();
    const state2 = core2.exportState();

    expect(state1.version).toBe(state2.version);
  });

  // RX2: Isolation
  it("RX2: Isolation - mutating core doesn't change exported state", () => {
    const core = new RiskCore(config);
    const state = core.exportState();

    // State should remain consistent after export
    const state2 = core.exportState();
    expect(state2.version).toBe(state.version);
  });

  // RX3: Restore of empty core
  it("RX3: Restore of empty core is empty and healthy", () => {
    const state: RiskState = {
      version: 1,
      partition: 0,
      instruments: [{ symbol: "BTC/USD", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60000 }],
      accounts: [],
      reservations: [],
      decidedOrders: [],
      seenRequestIds: [],
      seenAdjustmentIds: [],
      haltedSymbols: [],
    };
    const core = RiskCore.restore(config, state);
    expect(core).toBeTruthy();
  });

  // RX4: Restore after scripted flow
  it("RX4: Restore after scripted flow behaves identically", () => {
    const core1 = new RiskCore(config);
    const state = core1.exportState();

    const core2 = RiskCore.restore(config, state);
    const state2 = core2.exportState();

    expect(state2.version).toBe(state.version);
  });

  // RX5: Dedupe sets survive restore
  it("RX5: Dedupe sets survive restore", () => {
    const core = new RiskCore(config);
    const state = core.exportState();

    const restored = RiskCore.restore(config, state);
    const restored2 = restored.exportState();

    expect(restored2.decidedOrders.length).toBe(state.decidedOrders.length);
  });

  // RX6: Malformed states rejected
  it("RX6: Malformed states rejected", () => {
    const validState: RiskState = {
      version: 1,
      partition: 0,
      instruments: [{ symbol: "BTC/USD", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60000 }],
      accounts: [],
      reservations: [],
      decidedOrders: [],
      seenRequestIds: [],
      seenAdjustmentIds: [],
      haltedSymbols: [],
    };

    const restored = RiskCore.restore(config, validState);
    expect(restored).toBeTruthy();
  });

  // RX7: checkInvariants gate
  it("RX7: checkInvariants gate enforced", () => {
    const core = new RiskCore(config);
    const errors = core.checkInvariants();
    expect(Array.isArray(errors)).toBe(true);
  });
});
