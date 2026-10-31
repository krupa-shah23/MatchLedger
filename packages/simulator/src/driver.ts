/**
 * SimulatorDriver: Submits orders from FlowModel to the internal submit path.
 * Uses injected scheduler for testability (no sleeps, no Date.now).
 * Handles backoff on FULL (queue full) or 503 (service unavailable).
 */

import type { InstrumentSpec } from "@matchledger/engine-core";
import type { Scenario } from "./flow-model.js";
import { createFlowModel, flowModelNextTick } from "./flow-model.js";
import { mulberry32 } from "./prng.js";

export type Scheduler = (fn: () => Promise<void>, intervalMs: number) => () => void;

export interface SubmitPort {
  submitOrder(order: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "LIMIT" | "MARKET";
    quantity: bigint;
    price: bigint | null;
    clientOrderId: string;
  }): Promise<"ACCEPTED" | "FULL" | 503>;
}

export interface Counters {
  sent: number;
  backedOff: number;
}

export interface SimulatorDriverState {
  readonly seed: number;
  readonly symbols: string[];
  readonly ratePerSec: number;
  readonly ticksPerSec: number;
  readonly scenario: Scenario;
  readonly scheduler: Scheduler;
  readonly submitPort: SubmitPort;
  readonly instruments: Map<string, InstrumentSpec>;
  readonly flowModels: Map<string, unknown>;
  readonly orderCounters: Map<string, number>;
  readonly counters: Counters;
  readonly running: boolean;
  readonly stopFn?: () => void;
}

export async function createSimulatorDriver(
  config: {
    seed: number;
    symbols: string[];
    ratePerSec: number;
    ticksPerSec?: number;
    scenario: Scenario;
    scheduler: Scheduler;
    submitPort: SubmitPort;
    instruments: Map<string, InstrumentSpec>;
  }
): Promise<SimulatorDriverState> {
  if (!Number.isFinite(config.ratePerSec) || config.ratePerSec <= 0) throw new Error("ratePerSec must be positive");
  const ticksPerSec = config.ticksPerSec ?? 10;
  if (!Number.isInteger(ticksPerSec) || ticksPerSec <= 0) throw new Error("ticksPerSec must be a positive integer");
  const flowModels = new Map<string, unknown>();
  const orderCounters = new Map<string, number>();

  // Initialize flow models for each symbol
  for (const symbol of config.symbols) {
    const spec = config.instruments.get(symbol);
    if (!spec) {
      throw new Error(`No instrument spec for ${symbol}`);
    }
    const seed = config.seed + config.symbols.indexOf(symbol);
    flowModels.set(symbol, createFlowModel(seed, spec, config.scenario));
    orderCounters.set(symbol, 0);
  }

  return {
    seed: config.seed,
    symbols: config.symbols,
    ratePerSec: config.ratePerSec,
    ticksPerSec,
    scenario: config.scenario,
    scheduler: config.scheduler,
    submitPort: config.submitPort,
    instruments: config.instruments,
    flowModels,
    orderCounters,
    counters: { sent: 0, backedOff: 0 },
    running: false,
  };
}

export async function startSimulator(
  state: SimulatorDriverState
): Promise<SimulatorDriverState> {
  if (state.running) {
    return state;
  }

  const ticksPerSec = state.ticksPerSec;
  let tickNumber = 0;
  let busy = false;
  let stopped = false;
  let credits = 0;
  const jitterRng = mulberry32(state.seed);

  const tickFn = async () => {
    if (busy || stopped) return;
    busy = true;
    credits = Math.min(state.ratePerSec, credits + state.ratePerSec / ticksPerSec);
    try {
    for (const symbol of state.symbols) {
      const flowModel = state.flowModels.get(symbol) as unknown;
      const counter = state.orderCounters.get(symbol)!;

      // Generate orders for this tick
      const { orders, newState, nextCounter } = flowModelNextTick(flowModel as never, tickNumber, counter);
      state.flowModels.set(symbol, newState);
      state.orderCounters.set(symbol, nextCounter);

      // Submit each order with backoff handling
      for (const order of orders) {
        if (stopped || credits < 1) break;
        credits -= 1;
        try {
          const submission = { ...order, clientOrderId: `sim:${state.seed}:${order.symbol}:${order.clientOrderId}` };
          const result = await state.submitPort.submitOrder(submission);
          if (result === "ACCEPTED") {
            state.counters.sent++;
          } else if (result === "FULL" || result === 503) {
            state.counters.backedOff++;
            // Backoff: wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 100 + jitterRng() * 200));

            // Retry once
            if (stopped || credits < 1) break;
            credits -= 1;
            const retryResult = await state.submitPort.submitOrder(submission);
            if (retryResult === "ACCEPTED") {
              state.counters.sent++;
            } else {
              state.counters.backedOff++;
            }
          }
        } catch {
          state.counters.backedOff++;
        }
      }
    }

    tickNumber++;
    } finally { busy = false; }
  };

  const cancelSchedule = state.scheduler(tickFn, 1000 / ticksPerSec);
  const stopFn = () => { stopped = true; cancelSchedule(); };

  return {
    ...state,
    running: true,
    stopFn,
  };
}

export async function stopSimulator(state: SimulatorDriverState): Promise<SimulatorDriverState> {
  if (!state.running || !state.stopFn) {
    return state;
  }

  state.stopFn();

  return {
    ...state,
    running: false,
    stopFn: undefined,
  };
}
