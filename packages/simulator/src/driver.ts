/**
 * SimulatorDriver: Submits orders from FlowModel to the internal submit path.
 * Uses injected scheduler for testability (no sleeps, no Date.now).
 * Handles backoff on FULL (queue full) or 503 (service unavailable).
 */

import type { InstrumentSpec } from "@matchledger/engine-core";
import type { Scenario } from "./flow-model.js";
import { createFlowModel, flowModelNextTick } from "./flow-model.js";

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
    scenario: Scenario;
    scheduler: Scheduler;
    submitPort: SubmitPort;
    instruments: Map<string, InstrumentSpec>;
  }
): Promise<SimulatorDriverState> {
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

  const ticksPerSec = 10; // 10 ticks per second
  let tickNumber = 0;

  const tickFn = async () => {
    for (const symbol of state.symbols) {
      const flowModel = state.flowModels.get(symbol) as unknown;
      const counter = state.orderCounters.get(symbol)!;

      // Generate orders for this tick
      const { orders, newState, nextCounter } = flowModelNextTick(flowModel as never, tickNumber, counter);
      state.flowModels.set(symbol, newState);
      state.orderCounters.set(symbol, nextCounter);

      // Submit each order with backoff handling
      for (const order of orders) {
        try {
          const result = await state.submitPort.submitOrder(order);
          if (result === "ACCEPTED") {
            state.counters.sent++;
          } else if (result === "FULL" || result === 503) {
            state.counters.backedOff++;
            // Backoff: wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

            // Retry once
            const retryResult = await state.submitPort.submitOrder({
              ...order,
              clientOrderId: order.clientOrderId + "-retry1",
            });
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
  };

  const stopFn = state.scheduler(tickFn, 1000 / ticksPerSec);

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
