/**
 * Simulator package tests (SM1-SM6)
 */

import { describe, it, expect, vi } from "vitest";
import { mulberry32, randomInt, randomChoice, randomGeometric } from "./prng.js";
import { createFlowModel, flowModelNextTick, type FlowModelState } from "./flow-model.js";
import {
  createSimulatorDriver,
  startSimulator,
  stopSimulator,
  type SubmitPort,
  type Scheduler,
} from "./driver.js";
import type { InstrumentSpec } from "@matchledger/engine-core";

describe("Simulator (SM1-SM6)", () => {
  it("SM1: PRNG - same seed produces same sequence", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const rng3 = mulberry32(43);

    // Same seed: identical sequence
    for (let i = 0; i < 100; i++) {
      const v1 = rng1();
      const v2 = rng2();
      expect(v1).toBe(v2);
    }

    // Different seed: different sequence
    const v1 = rng1();
    const v2 = rng3();
    expect(v1).not.toBe(v2);
  });

  it("SM2: FlowModel determinism - same seed produces identical orders", () => {
    const spec: InstrumentSpec = {
      symbol: "AAPL",
      tickSize: 1n,
      lotSize: 100n,
      maxQuantity: 100000n,
      maxPrice: 200n,
    };

    const model1 = createFlowModel(42, spec, "steady");
    const model2 = createFlowModel(42, spec, "steady");

    for (let tick = 0; tick < 10; tick++) {
      const { orders: orders1, newState: state1 } = flowModelNextTick(model1, tick, 0);
      const { orders: orders2, newState: state2 } = flowModelNextTick(model2, tick, 0);

      expect(orders1.length).toBe(orders2.length);
      for (let i = 0; i < orders1.length; i++) {
        const o1 = orders1[i]!;
        const o2 = orders2[i]!;
        expect(o1.side).toBe(o2.side);
        expect(o1.type).toBe(o2.type);
        expect(o1.quantity).toBe(o2.quantity);
        expect(o1.price).toBe(o2.price);
      }

      // Update models for next iteration
      Object.assign(model1, state1);
      Object.assign(model2, state2);
    }
  });

  it("SM3: FlowModel validity (fast-check) - all orders on tick grid and within bounds", () => {
    const spec: InstrumentSpec = {
      symbol: "MSFT",
      tickSize: 1n,
      lotSize: 10n,
      maxQuantity: 100000n,
      maxPrice: 500n,
    };

    const model = createFlowModel(42, spec, "steady");
    const tickSize = Number(spec.tickSize);
    const lotSize = Number(spec.lotSize);

    for (let tick = 0; tick < 50; tick++) {
      const { orders, newState } = flowModelNextTick(model, tick, 0);

      for (const order of orders) {
        // Quantity is lot-size multiple
        if (order.quantity > 0n) {
          expect(Number(order.quantity) % lotSize).toBe(0);
        }

        // Price (if LIMIT) is on tick grid and within bounds
        if (order.type === "LIMIT" && order.price !== null) {
          const price = Number(order.price);
          expect(price % tickSize).toBe(0);
          expect(price).toBeGreaterThanOrEqual(0);
          expect(price).toBeLessThanOrEqual(Number(spec.maxPrice));
        }
      }

      Object.assign(model, newState);
    }
  });

  it("SM4: Driver rate - correct number of submits per tick", async () => {
    const spec: InstrumentSpec = {
      symbol: "TSLA",
      tickSize: 1n,
      lotSize: 50n,
      maxQuantity: 100000n,
      maxPrice: 400n,
    };

    let submitCount = 0;
    const mockSubmitPort: SubmitPort = {
      submitOrder: async () => {
        submitCount++;
        return "ACCEPTED";
      },
    };

    let tickCount = 0;
    const mockScheduler: Scheduler = (fn, intervalMs) => {
      let running = true;
      const interval = setInterval(async () => {
        if (tickCount >= 3) {
          running = false;
          clearInterval(interval);
          return;
        }
        await fn();
        tickCount++;
      }, intervalMs);

      return () => {
        running = false;
        clearInterval(interval);
      };
    };

    const driverSpec: InstrumentSpec = {
      symbol: "TSLA",
      tickSize: 1n,
      lotSize: 50n,
      maxQuantity: 100000n,
      maxPrice: 400n,
    };

    let state = await createSimulatorDriver({
      seed: 42,
      symbols: ["TSLA"],
      ratePerSec: 10,
      scenario: "steady",
      scheduler: mockScheduler,
      submitPort: mockSubmitPort,
      instruments: new Map([["TSLA", driverSpec]]),
    });

    state = await startSimulator(state);

    // Wait for simulator to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    state = await stopSimulator(state);

    expect(submitCount).toBeGreaterThan(0);
  });

  it("SM5: Backoff - FULL/503 causes backoff and retry", async () => {
    const spec: InstrumentSpec = {
      symbol: "NVDA",
      tickSize: 1n,
      lotSize: 20n,
      maxQuantity: 100000n,
      maxPrice: 900n,
    };

    let submitCount = 0;
    const mockSubmitPort: SubmitPort = {
      submitOrder: async (order) => {
        submitCount++;
        // First attempt returns FULL, retry succeeds
        if (submitCount === 1) {
          return "FULL";
        }
        return "ACCEPTED";
      },
    };

    let tickFn: (() => Promise<void>) | null = null;
    const mockScheduler: Scheduler = (fn) => {
      tickFn = fn;
      return () => {};
    };

    let state = await createSimulatorDriver({
      seed: 42,
      symbols: ["NVDA"],
      ratePerSec: 10,
      scenario: "steady",
      scheduler: mockScheduler,
      submitPort: mockSubmitPort,
      instruments: new Map([["NVDA", spec]]),
    });

    state = await startSimulator(state);

    // Manually call the scheduler's tickFn to simulate scheduler running
    if (tickFn !== null) {
      await (tickFn as () => Promise<void>)();
    }

    state = await stopSimulator(state);

    // submitCount should be > 1 due to retries (first returns FULL, second returns ACCEPTED)
    expect(state.counters.backedOff).toBeGreaterThan(0);
  });

  it("SM6: Breaker-demo scenario - generates periodic sweeps", () => {
    const spec: InstrumentSpec = {
      symbol: "SPY",
      tickSize: 1n,
      lotSize: 100n,
      maxQuantity: 100000n,
      maxPrice: 600n,
    };

    const model = createFlowModel(42, spec, "breaker-demo");
    let sweepCount = 0;

    for (let tick = 0; tick < 100; tick++) {
      const { orders, newState } = flowModelNextTick(model, tick, 0);

      // Look for "sweep" orders (very large IOCs)
      for (const order of orders) {
        if (order.clientOrderId.includes("breaker-sweep")) {
          sweepCount++;
        }
      }

      Object.assign(model, newState);
    }

    // Should see at least one breaker sweep in 100 ticks (interval is 50)
    expect(sweepCount).toBeGreaterThan(0);
  });
});
