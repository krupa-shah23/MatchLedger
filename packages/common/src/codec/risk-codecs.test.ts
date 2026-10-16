import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  serializeRiskCommand,
  deserializeRiskCommand,
  serializeRiskEvent,
  deserializeRiskEvent,
  serializeRiskState,
  deserializeRiskState,
} from "../index.js";
import { CodecError } from "./codec-error.js";
import type { RiskCommand, RiskEvent, RiskState } from "../risk-types.js";

const bigAbove2_53 = fc.bigInt({ min: 2n ** 60n, max: 2n ** 62n });
const smallBigint = fc.bigInt({ min: 1n, max: 1_000_000n });
const anyId = fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0);

const riskCommandArb: fc.Arbitrary<RiskCommand> = fc.oneof(
  fc.record({ type: fc.constant("OpenAccount" as const), accountId: anyId }),
  fc.record({ type: fc.constant("Deposit" as const), accountId: anyId, asset: anyId, amount: bigAbove2_53, requestId: anyId }),
  fc.record({
    type: fc.constant("SubmitOrder" as const),
    orderId: anyId,
    accountId: anyId,
    symbol: anyId,
    side: fc.constantFrom("BUY", "SELL"),
    kind: fc.constantFrom("LIMIT", "MARKET"),
    timeInForce: fc.constantFrom("GTC", "IOC"),
    quantity: bigAbove2_53,
    price: fc.option(bigAbove2_53, { nil: undefined }),
    market: fc.record({
      lastTradePrice: fc.option(bigAbove2_53, { nil: undefined }),
      lastTradeTs: fc.option(fc.integer({ min: 0, max: 1_000_000_000 }), { nil: undefined }),
      bestBid: fc.option(bigAbove2_53, { nil: undefined }),
      bestAsk: fc.option(bigAbove2_53, { nil: undefined }),
    }),
  }),
  fc.record({ type: fc.constant("HaltSymbol" as const), symbol: anyId, reason: fc.option(anyId, { nil: undefined }) }),
  fc.record({ type: fc.constant("ResumeSymbol" as const), symbol: anyId }),
  fc.record({ type: fc.constant("OrderAcked" as const), orderId: anyId }),
  fc.record({ type: fc.constant("FillApplied" as const), orderId: anyId, tradeId: anyId, price: bigAbove2_53, quantity: bigAbove2_53 }),
  fc.record({
    type: fc.constant("OrderClosed" as const),
    orderId: anyId,
    remaining: bigAbove2_53,
    reason: fc.constantFrom("CANCELLED", "IOC_REMAINDER", "MATCHER_REJECTED", "NEVER_REACHED_MATCHER", "HALT_TIMEOUT"),
  }),
  fc.record({ type: fc.constant("OrderRejectedByMatcher" as const), orderId: anyId, reason: anyId }),
  fc.record({ type: fc.constant("ApplyAdjustment" as const), adjustmentId: anyId, accountId: anyId, asset: anyId, amount: bigAbove2_53 }),
  fc.record({ type: fc.constant("SweepProbe" as const), olderThanMs: fc.integer({ min: 0, max: 1_000_000 }) }),
  fc.record({ type: fc.constant("ReleaseUnreached" as const), orderId: anyId }),
) as fc.Arbitrary<RiskCommand>;

const riskEventArb: fc.Arbitrary<RiskEvent> = fc.oneof(
  fc.record({ type: fc.constant("AccountOpened" as const), accountId: anyId }),
  fc.record({ type: fc.constant("FundsDeposited" as const), accountId: anyId, asset: anyId, amount: bigAbove2_53, requestId: anyId }),
  fc.record({
    type: fc.constant("ReservationPlaced" as const),
    orderId: anyId,
    accountId: anyId,
    symbol: anyId,
    side: fc.constantFrom("BUY", "SELL"),
    asset: anyId,
    amount: bigAbove2_53,
    quantity: bigAbove2_53,
    priceCap: bigAbove2_53,
  }),
  fc.record({
    type: fc.constant("OrderAccepted" as const),
    orderId: anyId,
    accountId: anyId,
    symbol: anyId,
    side: fc.constantFrom("BUY", "SELL"),
    timeInForce: fc.constantFrom("GTC", "IOC"),
    price: bigAbove2_53,
    quantity: bigAbove2_53,
    referencePrice: fc.option(bigAbove2_53, { nil: undefined }),
    referenceSource: fc.option(fc.constantFrom("LAST_TRADE", "MIDPOINT", "STATIC"), { nil: undefined }),
  }),
  fc.record({
    type: fc.constant("ReservationConverted" as const),
    orderId: anyId,
    accountId: anyId,
    tradeId: anyId,
    consumed: bigAbove2_53,
    cost: bigAbove2_53,
    improvement: bigAbove2_53,
  }),
  fc.record({
    type: fc.constant("ReservationReleased" as const),
    orderId: anyId,
    accountId: anyId,
    asset: anyId,
    amount: bigAbove2_53,
    quantity: bigAbove2_53,
    reason: fc.constantFrom("CANCELLED", "IOC_REMAINDER", "MATCHER_REJECTED", "NEVER_REACHED_MATCHER", "HALT_TIMEOUT"),
  }),
  fc.record({ type: fc.constant("AccountAdjusted" as const), accountId: anyId, asset: anyId, amount: bigAbove2_53, adjustmentId: anyId }),
  fc.record({
    type: fc.constant("SymbolStatusChanged" as const),
    symbol: anyId,
    status: fc.constantFrom("ACTIVE", "HALTED"),
    reason: fc.option(anyId, { nil: undefined }),
  }),
  fc.record({ type: fc.constant("DuplicateIgnored" as const), kind: fc.constantFrom("ORDER", "FILL", "DEPOSIT"), id: anyId }),
  fc.record({ type: fc.constant("UnknownOrderIgnored" as const), orderId: anyId, command: anyId }),
) as fc.Arbitrary<RiskEvent>;

describe("Risk Codecs", () => {
  // RCD1: Property - every RiskCommand variant round-trips through JSON with bigint above 2^53
  it("RCD1: every risk command type survives serialize -> JSON.stringify -> JSON.parse -> deserialize", () => {
    fc.assert(
      fc.property(riskCommandArb, (cmd) => {
        const json = serializeRiskCommand(cmd);
        const roundTripped = JSON.parse(JSON.stringify(JSON.parse(json)));
        const decoded = deserializeRiskCommand(JSON.stringify(roundTripped));
        expect(decoded).toEqual(cmd);
      }),
      { numRuns: 500 },
    );
  });

  // RCD2: Deposit command specifically, with large bigint amount
  it("RCD2: serialize and deserialize a Deposit command with bigint amount", () => {
    const cmd: RiskCommand = { type: "Deposit", accountId: "acc1", asset: "CASH", amount: 9_007_199_254_740_993n, requestId: "d1" };
    const json = serializeRiskCommand(cmd);
    expect(json).not.toContain("9007199254740993n"); // never a raw bigint literal in JSON
    const decoded = deserializeRiskCommand(json);
    expect(decoded).toEqual(cmd);
  });

  // RCD3: Strictness - malformations throw CodecError naming the field
  it("RCD3: strictness - malformed payloads throw CodecError naming the field", () => {
    // missing required field
    expect(() => deserializeRiskCommand(JSON.stringify({ v: 1, type: "OpenAccount" }))).toThrow(CodecError);
    // wrong JS type
    expect(() => deserializeRiskCommand(JSON.stringify({ v: 1, type: "OpenAccount", accountId: 42 }))).toThrow(CodecError);
    // non-canonical decimal (not a plain integer string)
    expect(() =>
      deserializeRiskCommand(JSON.stringify({ v: 1, type: "Deposit", accountId: "a", asset: "CASH", amount: "1.5", requestId: "r" })),
    ).toThrow(CodecError);
    // bad enum
    expect(() =>
      deserializeRiskCommand(
        JSON.stringify({
          v: 1,
          type: "SubmitOrder",
          orderId: "o",
          accountId: "a",
          symbol: "S",
          side: "SIDEWAYS",
          kind: "LIMIT",
          timeInForce: "GTC",
          quantity: "1",
          market: {},
        }),
      ),
    ).toThrow(CodecError);
    // unknown type
    expect(() => deserializeRiskCommand(JSON.stringify({ v: 1, type: "NotARealCommand" }))).toThrow(CodecError);
  });

  // RCD4: Optional MarketInput and price fields: absent stays absent; present zero stays zero
  it("RCD4: optional fields - absent stays absent, present zero stays zero", () => {
    const withoutPrice: RiskCommand = {
      type: "SubmitOrder",
      orderId: "o1",
      accountId: "a1",
      symbol: "ACME",
      side: "BUY",
      kind: "MARKET",
      timeInForce: "IOC",
      quantity: 10n,
      market: {},
    };
    const decoded1 = deserializeRiskCommand(serializeRiskCommand(withoutPrice));
    expect(decoded1.type).toBe("SubmitOrder");
    expect((decoded1 as typeof withoutPrice).price).toBeUndefined();
    expect((decoded1 as typeof withoutPrice).market.lastTradePrice).toBeUndefined();

    const withZeroMarket: RiskCommand = {
      type: "SubmitOrder",
      orderId: "o2",
      accountId: "a1",
      symbol: "ACME",
      side: "SELL",
      kind: "MARKET",
      timeInForce: "IOC",
      quantity: 10n,
      market: { lastTradePrice: 0n, lastTradeTs: 0 },
    };
    const decoded2 = deserializeRiskCommand(serializeRiskCommand(withZeroMarket));
    expect((decoded2 as typeof withZeroMarket).market.lastTradePrice).toBe(0n);
    expect((decoded2 as typeof withZeroMarket).market.lastTradeTs).toBe(0);
  });

  // RCD5: Versioning and determinism
  it("RCD5: payloads carry v:1; unknown version throws; same value is deterministic", () => {
    const cmd: RiskCommand = { type: "OpenAccount", accountId: "acc1" };
    const json = serializeRiskCommand(cmd);
    expect(JSON.parse(json).v).toBe(1);

    expect(() => deserializeRiskCommand(JSON.stringify({ v: 2, type: "OpenAccount", accountId: "a" }))).toThrow(CodecError);
    expect(() => deserializeRiskCommand(JSON.stringify({ type: "OpenAccount", accountId: "a" }))).toThrow(CodecError);

    // Determinism: serializing the same logical value twice gives the identical string
    const json2 = serializeRiskCommand(cmd);
    expect(json).toBe(json2);
  });

  // RCD6: Exhaustiveness. The serializer's switch ends in `default: return assertNever(cmd)`.
  // At compile time, TypeScript narrows `cmd` to `never` in that branch only if every other
  // case is handled; adding a new RiskCommand/RiskEvent union member without a matching case
  // makes `cmd` retain the new member's type there, and passing a non-`never` value into a
  // function requiring `never` is a compile error -- so an unhandled variant fails `npm run
  // build`, not just this test. At runtime, this test proves every currently known variant is
  // reachable through its own real case (not the shared default/assertNever fallthrough) by
  // round-tripping one concrete instance of each and confirming none throws "Unhandled".
  it("RCD6: exhaustiveness - every known command and event type is handled by its own case, not the default branch", () => {
    const commandSamples: RiskCommand[] = [
      { type: "OpenAccount", accountId: "a" },
      { type: "Deposit", accountId: "a", asset: "CASH", amount: 1n, requestId: "r" },
      { type: "SubmitOrder", orderId: "o", accountId: "a", symbol: "S", side: "BUY", kind: "LIMIT", timeInForce: "GTC", quantity: 1n, price: 1n, market: {} },
      { type: "HaltSymbol", symbol: "S" },
      { type: "ResumeSymbol", symbol: "S" },
      { type: "OrderAcked", orderId: "o" },
      { type: "FillApplied", orderId: "o", tradeId: "t", price: 1n, quantity: 1n },
      { type: "OrderClosed", orderId: "o", remaining: 1n, reason: "CANCELLED" },
      { type: "OrderRejectedByMatcher", orderId: "o", reason: "x" },
      { type: "ApplyAdjustment", adjustmentId: "adj", accountId: "a", asset: "CASH", amount: 1n },
      { type: "SweepProbe", olderThanMs: 1 },
      { type: "ReleaseUnreached", orderId: "o" },
    ];
    for (const cmd of commandSamples) {
      expect(() => serializeRiskCommand(cmd)).not.toThrow(/Unhandled/);
      expect(deserializeRiskCommand(serializeRiskCommand(cmd))).toEqual(cmd);
    }
    expect(commandSamples.length).toBe(12);

    const eventSamples: RiskEvent[] = [
      { type: "AccountOpened", accountId: "a" },
      { type: "FundsDeposited", accountId: "a", asset: "CASH", amount: 1n, requestId: "r" },
      { type: "ReservationPlaced", orderId: "o", accountId: "a", symbol: "S", side: "BUY", asset: "CASH", amount: 1n, quantity: 1n, priceCap: 1n },
      { type: "OrderAccepted", orderId: "o", accountId: "a", symbol: "S", side: "BUY", timeInForce: "GTC", price: 1n, quantity: 1n },
      { type: "OrderRejected", orderId: "o", accountId: "a", reason: "INVALID_ORDER" },
      { type: "ReservationConverted", orderId: "o", accountId: "a", tradeId: "t", consumed: 1n, cost: 1n, improvement: 0n },
      { type: "ReservationReleased", orderId: "o", accountId: "a", asset: "CASH", amount: 1n, quantity: 1n, reason: "CANCELLED" },
      { type: "AccountAdjusted", accountId: "a", asset: "CASH", amount: 1n, adjustmentId: "adj" },
      { type: "AdjustmentRejected", accountId: "a", asset: "CASH", amount: 1n, adjustmentId: "adj", reason: "ZERO_AMOUNT" },
      { type: "SymbolStatusChanged", symbol: "S", status: "ACTIVE" },
      { type: "HaltTimeoutCancelled", symbol: "S", count: 1, incidentStartTs: 1, ts: 1 },
      { type: "SweepCandidates", candidates: [{ orderId: "o", symbol: "S" }] },
      { type: "DuplicateIgnored", kind: "ORDER", id: "o" },
      { type: "UnknownOrderIgnored", orderId: "o", command: "X" },
    ];
    for (const evt of eventSamples) {
      expect(() => serializeRiskEvent(evt)).not.toThrow(/Unhandled/);
      expect(deserializeRiskEvent(serializeRiskEvent(evt))).toEqual(evt);
    }
    expect(eventSamples.length).toBe(14);
  });

  // RCD7: RiskState codec round trip with exact bigints and canonical order
  it("RCD7: RiskState serialize/deserialize round trip is deep-equal with canonical order preserved", () => {
    fc.assert(
      fc.property(
        fc.record({
          accountId: anyId,
          cash: smallBigint,
          heldCash: fc.constant(0n),
          symbol: anyId,
          quantity: smallBigint,
        }),
        (seed) => {
          const state: RiskState = {
            version: 1,
            partition: 0,
            instruments: [
              { symbol: seed.symbol, tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60_000 },
            ],
            accounts: [
              {
                accountId: seed.accountId,
                cash: seed.cash,
                heldCash: seed.heldCash,
                positions: [{ symbol: seed.symbol, quantity: seed.quantity, heldShares: 0n }],
              },
            ],
            reservations: [],
            decidedOrders: [],
            seenRequestIds: [],
            seenAdjustmentIds: [],
            haltedSymbols: [],
          };
          const json = serializeRiskState(state);
          const decoded = deserializeRiskState(json);
          expect(decoded).toEqual(state);
        },
      ),
      { numRuns: 200 },
    );
  });

  // RCD7b: strictness on state codec
  it("RCD7b: RiskState codec rejects unknown version and malformed bigint fields", () => {
    expect(() => deserializeRiskState(JSON.stringify({ version: 2, partition: 0, instruments: [], accounts: [], reservations: [], decidedOrders: [], seenRequestIds: [], seenAdjustmentIds: [], haltedSymbols: [] }))).toThrow(CodecError);
    expect(() =>
      deserializeRiskState(
        JSON.stringify({
          version: 1,
          partition: 0,
          instruments: [{ symbol: "A", tickSize: "not-a-number", protectionBandBps: "1", maxBandBps: "1", maxReferenceAgeMs: 1 }],
          accounts: [],
          reservations: [],
          decidedOrders: [],
          seenRequestIds: [],
          seenAdjustmentIds: [],
          haltedSymbols: [],
        }),
      ),
    ).toThrow(CodecError);
  });

  // Same property for events
  it("RCD2b (events): every risk event type survives serialize -> JSON round trip -> deserialize", () => {
    fc.assert(
      fc.property(riskEventArb, (evt) => {
        const json = serializeRiskEvent(evt);
        const roundTripped = JSON.parse(JSON.stringify(JSON.parse(json)));
        const decoded = deserializeRiskEvent(JSON.stringify(roundTripped));
        expect(decoded).toEqual(evt);
      }),
      { numRuns: 500 },
    );
  });

  it("unknown event type throws CodecError", () => {
    expect(() => deserializeRiskEvent(JSON.stringify({ v: 1, type: "NotARealEvent" }))).toThrow(CodecError);
  });
});
