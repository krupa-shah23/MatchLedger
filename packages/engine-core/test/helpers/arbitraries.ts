import fc from "fast-check";
import type { Command, InstrumentConfig, PlaceOrder, Side, TimeInForce } from "../../src/matching/types.js";

export const instrumentSpecArbitrary: fc.Arbitrary<InstrumentConfig> = fc.constantFrom(
  {
    symbol: "ABC",
    tickSize: 1n,
    lotSize: 1n,
    maxQuantity: 20n,
    maxPrice: 105n,
  },
  {
    symbol: "ABC",
    tickSize: 5n,
    lotSize: 10n,
    maxQuantity: 200n,
    maxPrice: 525n,
  },
);

const sideArbitrary: fc.Arbitrary<Side> = fc.constantFrom("BUY", "SELL");
const timeInForceArbitrary: fc.Arbitrary<TimeInForce> = fc.oneof(
  { weight: 7, arbitrary: fc.constant("GTC" as const) },
  { weight: 3, arbitrary: fc.constant("IOC" as const) },
);

export const commandSequenceArbitrary = (config: InstrumentConfig): fc.Arbitrary<Command[]> =>
  fc.array(
    fc.oneof(
      fc.record({
        kind: fc.constant("PLACE" as const),
        orderId: fc.stringMatching(/^o[0-9]{1,3}$/),
        accountId: fc.constantFrom("a1", "a2", "a3"),
        side: sideArbitrary,
        orderType: fc.constant("LIMIT" as const),
        timeInForce: timeInForceArbitrary,
        price: fc.integer({ min: 95, max: 105 }).map((value) => BigInt(value) * config.tickSize),
        quantity: fc.integer({ min: 1, max: 20 }).map((value) => BigInt(value) * config.lotSize),
      }),
      fc.record({
        kind: fc.constant("CANCEL" as const),
        orderId: fc.stringMatching(/^o[0-9]{1,3}$/),
      }),
      fc.constant({ kind: "TICK" as const }),
    ),
    { minLength: 1, maxLength: 300 },
  ).map((commands) => {
    let ts = 0n;
    return commands.map((command, index) => {
      ts += BigInt(index % 4);
      return { ...command, ts } as Command;
    });
  });

export const validGtcSequenceArbitrary = (config: InstrumentConfig): fc.Arbitrary<PlaceOrder[]> =>
  fc.array(
    fc.record({
      kind: fc.constant("PLACE" as const),
      ts: fc.nat({ max: 300 }).map(BigInt),
      orderId: fc.stringMatching(/^o[0-9]{1,3}$/),
      accountId: fc.constantFrom("a1", "a2", "a3"),
      side: sideArbitrary,
      orderType: fc.constant("LIMIT" as const),
      timeInForce: fc.constant("GTC" as const),
      price: fc.integer({ min: 95, max: 105 }).map((value) => BigInt(value) * config.tickSize),
      quantity: fc.integer({ min: 1, max: 20 }).map((value) => BigInt(value) * config.lotSize),
    }),
    { minLength: 1, maxLength: 300 },
  );
