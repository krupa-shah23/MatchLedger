import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Engine } from "../src/matching/engine.js";
import type { Command, Event, InstrumentConfig, PlaceOrder } from "../src/matching/types.js";
import { assertInvariants } from "./helpers/assert-invariants.js";
import { analyzeEvents } from "./helpers/event-analysis.js";
import { validGtcSequenceArbitrary } from "./helpers/arbitraries.js";
import { ReferenceMatcher } from "./helpers/reference-matcher.js";

const P1_RUNS = 5_000;
const OTHER_RUNS = 2_000;

const config: InstrumentConfig = {
  symbol: "ABC",
  tickSize: 1n,
  lotSize: 1n,
  maxQuantity: 20n,
  maxPrice: 105n,
};

const normalise = (commands: readonly PlaceOrder[]): PlaceOrder[] =>
  commands.map((command, index) => ({ ...command, orderId: `o${index}` }));

const runGtc = (commands: readonly PlaceOrder[]): { readonly engine: Engine; readonly steps: readonly { readonly command: Command; readonly events: readonly Event[] }[] } => {
  const engine = new Engine(config);
  const steps: { command: Command; events: Event[] }[] = [];
  normalise(commands).forEach((command) => {
    const events = engine.apply(command);
    assertInvariants(engine);
    steps.push({ command, events });
  });
  return { engine, steps };
};

describe("engine properties", () => {
  it("P1 never crosses the book", () => {
    fc.assert(
      fc.property(validGtcSequenceArbitrary(config), (commands) => {
        const { engine } = runGtc(commands);
        const view = engine.snapshotView();
        const bid = view.bidPrices.at(-1);
        const ask = view.askPrices.at(-1);
        expect(bid === undefined || ask === undefined || bid < ask).toBe(true);
      }),
      { numRuns: P1_RUNS },
    );
  }, 60_000);

  it("P2 conservation holds from event analysis", () => {
    fc.assert(fc.property(validGtcSequenceArbitrary(config), (commands) => {
      const { engine, steps } = runGtc(commands);
      const analysis = analyzeEvents(steps, engine.restingOrders());
      const buys = analysis.instances.filter((instance) => instance.side === "BUY").reduce((sum, instance) => sum + instance.filled, 0n);
      const sells = analysis.instances.filter((instance) => instance.side === "SELL").reduce((sum, instance) => sum + instance.filled, 0n);
      expect(buys).toBe(sells);
    }), { numRuns: OTHER_RUNS });
  });

  it("P3 trades are positive and never overfill instances", () => {
    fc.assert(fc.property(validGtcSequenceArbitrary(config), (commands) => {
      const { engine, steps } = runGtc(commands);
      const analysis = analyzeEvents(steps, engine.restingOrders());
      analysis.instances.forEach((instance) => expect(instance.filled <= instance.quantity).toBe(true));
      analysis.tradesByCommand.flat().forEach((trade) => expect(trade.quantity > 0n).toBe(true));
    }), { numRuns: OTHER_RUNS });
  });

  it("P4 preserves price-time ordering in observed trades", () => {
    fc.assert(fc.property(validGtcSequenceArbitrary(config), (commands) => {
      const { engine, steps } = runGtc(commands);
      const analysis = analyzeEvents(steps, engine.restingOrders());
      analysis.tradesByCommand.forEach((trades) => {
        const byPrice = new Map<bigint, number>();
        trades.forEach((trade) => {
          const arrival = trade.makerInstance?.arrivalIndex;
          if (arrival !== undefined) {
            const previous = byPrice.get(trade.price);
            expect(previous === undefined || arrival > previous).toBe(true);
            byPrice.set(trade.price, arrival);
          }
        });
      });
    }), { numRuns: OTHER_RUNS });
  });

  it("P11 keeps price views ordered and invariant-clean", () => {
    fc.assert(fc.property(validGtcSequenceArbitrary(config), (commands) => {
      const { engine } = runGtc(commands);
      const view = engine.snapshotView();
      expect(new Set(view.bidPrices).size).toBe(view.bidPrices.length);
      expect(new Set(view.askPrices).size).toBe(view.askPrices.length);
      expect(view.bidPrices.every((price, index) => index === 0 || view.bidPrices[index - 1]! < price)).toBe(true);
      expect(view.askPrices.every((price, index) => index === 0 || view.askPrices[index - 1]! > price)).toBe(true);
    }), { numRuns: OTHER_RUNS });
  });

  it("P12 accounts for every accepted GTC instance", () => {
    fc.assert(fc.property(validGtcSequenceArbitrary(config), (commands) => {
      const { engine, steps } = runGtc(commands);
      const analysis = analyzeEvents(steps, engine.restingOrders());
      const resting = new Map(engine.restingOrders().map((order) => [order.orderId, order.remaining]));
      analysis.instances.forEach((instance) => {
        const remaining = resting.get(instance.orderId) ?? 0n;
        expect(instance.filled + instance.cancelled + remaining).toBe(instance.quantity);
      });
    }), { numRuns: OTHER_RUNS });
  });

  it("P13 and P14 hold for the GTC regression subset", () => {
    fc.assert(fc.property(validGtcSequenceArbitrary(config), (commands) => {
      const first = runGtc(commands);
      const second = runGtc(commands);
      expect(first.steps).toEqual(second.steps);
      expect(first.engine.restingOrders()).toEqual(second.engine.restingOrders());
    }), { numRuns: OTHER_RUNS });
  });

  it("D1 is wired to the hand-written reference matcher", () => {
    fc.assert(fc.property(validGtcSequenceArbitrary(config), (commands) => {
      const engine = new Engine(config);
      const reference = new ReferenceMatcher(config);
      normalise(commands).forEach((command, index) => {
        const actual = engine.apply(command);
        assertInvariants(engine);
        let expected: Event[];
        try {
          expected = reference.apply(command);
        } catch (error) {
          throw new Error(`D1 reference matcher failed at command ${index}: ${String(error)}`);
        }
        expect(actual).toEqual(expected);
      });
      expect(engine.restingOrders()).toEqual(reference.restingOrders());
    }), { numRuns: OTHER_RUNS });
  });
});
