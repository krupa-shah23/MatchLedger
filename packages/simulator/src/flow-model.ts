/**
 * FlowModel: pure deterministic market model.
 * Generates realistic orders: makers, takers, IOCs, cancellations.
 * Same seed + config → identical order sequence.
 */

import { mulberry32, randomInt, randomChoice, randomGeometric } from "./prng.js";
import type { InstrumentSpec } from "@matchledger/engine-core";

export type Scenario = "steady" | "breaker-demo";

export interface GeneratedOrder {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: bigint;
  price: bigint | null; // null for MARKET
  clientOrderId: string;
}

export interface FlowModelState {
  readonly rng: () => number;
  readonly spec: InstrumentSpec;
  readonly scenario: Scenario;
  readonly midPriceTicks: number;
  readonly makerOrders: Set<string>;
  readonly ticksSinceBreakerSweep: number;
  readonly brekerSweepInterval: number;
}

export function createFlowModel(
  seed: number,
  spec: InstrumentSpec,
  scenario: Scenario = "steady"
): FlowModelState {
  const midPriceValue = Number(spec.maxPrice) / 2;
  const midPriceTicks = midPriceValue / Number(spec.tickSize);

  return {
    rng: mulberry32(seed),
    spec,
    scenario,
    midPriceTicks,
    makerOrders: new Set(),
    ticksSinceBreakerSweep: 0,
    brekerSweepInterval: 50, // Every 50 ticks
  };
}

export function flowModelNextTick(
  state: FlowModelState,
  tickNumber: number,
  orderIdCounter: number
): { orders: GeneratedOrder[]; newState: FlowModelState; nextCounter: number } {
  const orders: GeneratedOrder[] = [];
  let counter = orderIdCounter;

  // Random-walk mid price (±1 to 3 ticks), bounded by 0 and max price
  const priceMove = randomInt(state.rng, -3, 3);
  const maxPriceTicks = Number(state.spec.maxPrice) / Number(state.spec.tickSize);
  const newMidPriceTicks = Math.max(
    0,
    Math.min(maxPriceTicks, state.midPriceTicks + priceMove)
  );

  // Maker orders: place at mid ± offset
  const makerSide = randomChoice(state.rng, ["BUY", "SELL"] as const);
  const makerOffset = randomInt(state.rng, 1, 5);
  const makerPrice =
    makerSide === "BUY"
      ? newMidPriceTicks - makerOffset
      : newMidPriceTicks + makerOffset;

  // Maker quantity: geometric distribution starting at 1 lot
  const lotSize = Number(state.spec.lotSize);
  const geometricTrials = randomGeometric(state.rng, 0.6); // Expected ~1.67 lots
  const makerQty = Math.max(1, geometricTrials) * lotSize;

  const makerId = `sim-maker-${counter++}`;
  orders.push({
    symbol: state.spec.symbol,
    side: makerSide,
    type: "LIMIT",
    quantity: BigInt(makerQty),
    price: BigInt(Math.floor(makerPrice) * Number(state.spec.tickSize)),
    clientOrderId: makerId,
  });
  state.makerOrders.add(makerId);

  // Taker: IOC crossing the spread
  if (state.rng() < 0.4) {
    const takerSide = makerSide === "BUY" ? "SELL" : "BUY";
    randomInt(state.rng, 1, 3); // Taker offset for price
    const takerQty = Math.max(1, randomGeometric(state.rng, 0.5)) * lotSize;

    orders.push({
      symbol: state.spec.symbol,
      side: takerSide,
      type: "MARKET",
      quantity: BigInt(takerQty),
      price: null,
      clientOrderId: `sim-taker-${counter++}`,
    });
  }

  // Cancel a random maker order
  if (state.makerOrders.size > 0 && state.rng() < 0.3) {
    const toCancel = Array.from(state.makerOrders)[
      Math.floor(state.rng() * state.makerOrders.size)
    ];
    if (toCancel) {
      state.makerOrders.delete(toCancel);
      orders.push({
        symbol: state.spec.symbol,
        side: "BUY", // dummy, cancel doesn't use side but use for compatibility
        type: "LIMIT",
        quantity: 0n,
        price: null,
        clientOrderId: toCancel + "-CANCEL",
      });
    }
  }

  // Breaker-demo scenario: periodic aggressive sweeps
  let ticksSinceSweep = state.ticksSinceBreakerSweep + 1;
  if (state.scenario === "breaker-demo" && ticksSinceSweep >= state.brekerSweepInterval) {
    const sweepSide = randomChoice(state.rng, ["BUY", "SELL"] as const);
    const sweepQty = Math.max(1, randomGeometric(state.rng, 0.3)) * 5 * lotSize; // 5-10x normal size

    orders.push({
      symbol: state.spec.symbol,
      side: sweepSide,
      type: "MARKET",
      quantity: BigInt(sweepQty),
      price: null,
      clientOrderId: `sim-breaker-sweep-${counter++}`,
    });

    ticksSinceSweep = 0;
  }

  return {
    orders,
    newState: {
      ...state,
      midPriceTicks: newMidPriceTicks,
      ticksSinceBreakerSweep: ticksSinceSweep,
    },
    nextCounter: counter,
  };
}
