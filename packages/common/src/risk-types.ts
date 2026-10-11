/**
 * Shared risk domain protocol for the Week 6 reservation stage.
 *
 * Money is encoded as bigint minor units and every command and event is replayable
 * from the journal without depending on wall-clock time or the read side.
 */

export const MAX_AMOUNT = 2n ** 63n - 1n;

export type RiskSide = "BUY" | "SELL";
export type RiskTimeInForce = "GTC" | "IOC";
export type OrderKind = "LIMIT" | "MARKET";

export type MarketInput = Readonly<{
  readonly lastTradePrice?: bigint;
  readonly lastTradeTs?: number;
  readonly bestBid?: bigint;
  readonly bestAsk?: bigint;
}>;

export type InstrumentRiskConfig = Readonly<{
  readonly symbol: string;
  readonly tickSize: bigint;
  readonly maxPrice?: bigint;
  readonly protectionBandBps: bigint;
  readonly maxBandBps: bigint;
  readonly referencePriceTicks?: bigint;
  readonly maxReferenceAgeMs: number;
}>;

export type RiskConfig = Readonly<{
  readonly instruments: ReadonlyMap<string, InstrumentRiskConfig>;
}>;

export type AccountSnapshot = Readonly<{
  readonly cash: bigint;
  readonly heldCash: bigint;
  readonly availableCash: bigint;
  readonly positionQuantity: bigint;
  readonly heldShares: bigint;
  readonly availableShares: bigint;
}>;

export type RiskRejectReason =
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_POSITION"
  | "NO_REFERENCE_PRICE"
  | "UNKNOWN_ACCOUNT"
  | "UNKNOWN_SYMBOL"
  | "INVALID_ORDER"
  | "SYMBOL_HALTED"
  | "ZERO_AMOUNT"
  | "HOLD_INVARIANT";

export type ReleaseReason =
  | "CANCELLED"
  | "IOC_REMAINDER"
  | "MATCHER_REJECTED"
  | "NEVER_REACHED_MATCHER"
  | "HALT_TIMEOUT";

export type RiskCommand =
  | { readonly type: "OpenAccount"; readonly accountId: string }
  | { readonly type: "Deposit"; readonly accountId: string; readonly asset: string; readonly amount: bigint; readonly requestId: string }
  | {
      readonly type: "SubmitOrder";
      readonly orderId: string;
      readonly accountId: string;
      readonly symbol: string;
      readonly side: RiskSide;
      readonly kind: OrderKind;
      readonly timeInForce: RiskTimeInForce;
      readonly quantity: bigint;
      readonly price?: bigint;
      readonly market: MarketInput;
    }
  | { readonly type: "HaltSymbol"; readonly symbol: string; readonly reason?: string }
  | { readonly type: "ResumeSymbol"; readonly symbol: string }
  | { readonly type: "OrderAcked"; readonly orderId: string }
  | { readonly type: "FillApplied"; readonly orderId: string; readonly tradeId: string; readonly price: bigint; readonly quantity: bigint }
  | { readonly type: "OrderClosed"; readonly orderId: string; readonly remaining: bigint; readonly reason: ReleaseReason }
  | { readonly type: "OrderRejectedByMatcher"; readonly orderId: string; readonly reason: string }
  | { readonly type: "ApplyAdjustment"; readonly adjustmentId: string; readonly accountId: string; readonly asset: string; readonly amount: bigint }
  | { readonly type: "SweepProbe"; readonly olderThanMs: number }
  | { readonly type: "ReleaseUnreached"; readonly orderId: string };

export type RiskEvent =
  | { readonly type: "AccountOpened"; readonly accountId: string }
  | { readonly type: "FundsDeposited"; readonly accountId: string; readonly asset: string; readonly amount: bigint; readonly requestId: string }
  | {
      readonly type: "ReservationPlaced";
      readonly orderId: string;
      readonly accountId: string;
      readonly symbol: string;
      readonly side: RiskSide;
      readonly asset: string;
      readonly amount: bigint;
      readonly quantity: bigint;
      readonly priceCap: bigint;
    }
  | {
      readonly type: "OrderAccepted";
      readonly orderId: string;
      readonly accountId: string;
      readonly symbol: string;
      readonly side: RiskSide;
      readonly timeInForce: RiskTimeInForce;
      readonly price: bigint;
      readonly quantity: bigint;
      readonly referencePrice?: bigint;
      readonly referenceSource?: "LAST_TRADE" | "MIDPOINT" | "STATIC";
    }
  | {
      readonly type: "OrderRejected";
      readonly orderId: string;
      readonly accountId: string;
      readonly reason: RiskRejectReason;
      readonly required?: bigint;
      readonly snapshot?: AccountSnapshot;
    }
  | {
      readonly type: "ReservationConverted";
      readonly orderId: string;
      readonly accountId: string;
      readonly tradeId: string;
      readonly consumed: bigint;
      readonly cost: bigint;
      readonly improvement: bigint;
    }
  | {
      readonly type: "ReservationReleased";
      readonly orderId: string;
      readonly accountId: string;
      readonly asset: string;
      readonly amount: bigint;
      readonly quantity: bigint;
      readonly reason: ReleaseReason;
    }
  | {
      readonly type: "AccountAdjusted";
      readonly accountId: string;
      readonly asset: string;
      readonly amount: bigint;
      readonly adjustmentId: string;
    }
  | {
      readonly type: "AdjustmentRejected";
      readonly accountId: string;
      readonly asset: string;
      readonly amount: bigint;
      readonly adjustmentId: string;
      readonly reason: RiskRejectReason;
    }
  | {
      readonly type: "SymbolStatusChanged";
      readonly symbol: string;
      readonly status: "ACTIVE" | "HALTED";
      readonly reason?: string;
    }
  | {
      readonly type: "HaltTimeoutCancelled";
      readonly symbol: string;
      readonly count: number;
      readonly incidentStartTs: number;
      readonly ts: number;
    }
  | { readonly type: "SweepCandidates"; readonly candidates: readonly Readonly<{ readonly orderId: string; readonly symbol: string }>[] }
  | { readonly type: "DuplicateIgnored"; readonly kind: "ORDER" | "FILL" | "DEPOSIT"; readonly id: string }
  | { readonly type: "UnknownOrderIgnored"; readonly orderId: string; readonly command: string };

export type StampedRiskCommand = Readonly<{
  readonly partition: number;
  readonly seq: number;
  readonly ts: number;
  readonly command: RiskCommand;
}>;

export type RiskOutput = Readonly<{
  readonly partition: number;
  readonly seq: number;
  readonly ts: number;
  readonly command: RiskCommand;
  readonly events: readonly RiskEvent[];
}>;

export interface RiskJournalAppender {
  /** Appends one or more stamped commands atomically before the core mutates state. */
  append(batch: readonly StampedRiskCommand[]): Promise<void>;
}

export interface RiskOutbox {
  /** Publishes a risk output batch in the same partition and order it was generated. */
  publish(partition: number, outputs: readonly RiskOutput[]): Promise<void>;
}
