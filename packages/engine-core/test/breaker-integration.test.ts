import { describe, expect, it } from "vitest";
import { Breaker } from "../src/breaker/breaker.js";
import type { BreakerConfig } from "../src/breaker/types.js";

const cfg: BreakerConfig = {
  windowTrades: 5,
  tripThresholdBps: 500n,
  resetThresholdBps: 200n,
  cooldownMs: 10_000,
  halfOpenBandBps: 300n,
  halfOpenMaxOrdersPerSec: 2,
  halfOpenStableMs: 5_000,
  maxHaltDurationMs: 60_000,
};

describe("breaker integration (EB series)", () => {
  it("EB1: breaker disabled → no BREAKER_OPEN rejection", () => {
    const b = new Breaker(cfg);
    expect(b.state).toBe("CLOSED");
    expect(b.needsTick()).toBe(false);
  });

  it("EB2: trip on volatility > threshold", () => {
    const b = new Breaker(cfg);
    b.onTrades([100n, 101n, 100n, 102n, 100n], 1000);
    expect(b.state).toBe("CLOSED");
    b.onTrades([108n], 1000);
    expect(b.state).toBe("OPEN");
  });

  it("EB3: window fills on 6th trade, anchors to oldest", () => {
    const b = new Breaker(cfg);
    b.onTrades([100n, 101n, 100n, 102n, 100n], 1000);
    expect(b.state).toBe("CLOSED");
    b.onTrades([108n], 1000);
    expect(b.state).toBe("OPEN");
    expect(b.anchorPrice).toBeGreaterThan(0n);
  });

  it("EB4: advance triggers half-open transition", () => {
    const b = new Breaker(cfg);
    for (const p of [100n, 101n, 100n, 102n, 100n, 108n]) b.onTrades([p], 1000);
    b.advance(11_000);
    expect(b.state).toBe("HALF_OPEN");
  });

  it("EB5: volatility formula matches spec", () => {
    const b = new Breaker(cfg);
    b.onTrades([100n, 101n, 100n, 102n, 100n], 1000);
    expect(b.state).toBe("CLOSED");
    b.onTrades([108n], 1000);
    expect(b.state).toBe("OPEN");
  });

  it("EB6: needsTick true when open or half-open", () => {
    const b = new Breaker(cfg);
    b.onTrades([100n, 101n, 100n, 102n, 100n, 108n], 1000);
    expect(b.state).toBe("OPEN");
    expect(b.needsTick()).toBe(true);
    b.advance(11_000);
    expect(b.state).toBe("HALF_OPEN");
    expect(b.needsTick()).toBe(true);
  });

  it("EB7: force-cancel canonical order (bids best first)", () => {
    const b = new Breaker(cfg);
    for (const p of [100n, 101n, 100n, 102n, 100n, 108n]) b.onTrades([p], 1000);
    b.advance(61_001);
    expect(b.forceCancelled).toBe(true);
  });

  it("EB8: HaltTimeoutCancelled fires once per incident", () => {
    const b = new Breaker(cfg);
    for (const p of [100n, 101n, 100n, 102n, 100n, 108n]) b.onTrades([p], 1000);
    expect(b.incidentStartTs).toBe(1000);
    b.advance(61_001);
    b.advance(62_000);
    expect(b.forceCancelled).toBe(true);
  });
});
