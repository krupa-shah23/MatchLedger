export type Account = {
  cash: bigint;
  heldCash: bigint;
  positions: Map<string, { quantity: bigint; heldShares: bigint }>;
};

export type Reservation = {
  orderId: string;
  accountId: string;
  symbol: string;
  side: "BUY" | "SELL";
  priceCap: bigint;
  qtyRemaining: bigint;
  amountRemaining: bigint;
  state: "PENDING_ACK" | "LIVE";
  placedTs: number;
  placedSeq: number;
  appliedTradeIds: Set<string>;
};

export type AccountRecord = Readonly<{
  readonly cash: bigint;
  readonly heldCash: bigint;
  readonly positions: ReadonlyMap<string, { readonly quantity: bigint; readonly heldShares: bigint }>;
}>;

export type ReservationRecord = Readonly<{
  readonly orderId: string;
  readonly accountId: string;
  readonly symbol: string;
  readonly side: "BUY" | "SELL";
  readonly priceCap: bigint;
  readonly qtyRemaining: bigint;
  readonly amountRemaining: bigint;
  readonly state: "PENDING_ACK" | "LIVE";
  readonly placedTs: number;
  readonly placedSeq: number;
  readonly appliedTradeIds: ReadonlySet<string>;
}>;

export type HeldBySymbol = Readonly<{
  readonly symbol: string;
  readonly amount: bigint;
  readonly reason: "RESTING_ORDER";
}>;

export type AccountView = Readonly<{
  readonly cash: bigint;
  readonly heldCash: bigint;
  readonly availableCash: bigint;
  readonly positions: ReadonlyMap<string, Readonly<{ readonly quantity: bigint; readonly heldShares: bigint; readonly availableShares: bigint }>>;
  readonly heldBySymbol: ReadonlyArray<HeldBySymbol>;
}>;

export type RiskSnapshot = Readonly<{
  readonly accounts: ReadonlyArray<readonly [string, AccountRecord]>;
  readonly reservations: ReadonlyArray<readonly [string, ReservationRecord]>;
  readonly haltedSymbols: ReadonlyArray<string>;
  readonly dedupe: Readonly<{
    readonly decidedOrders: number;
    readonly seenRequestIds: number;
  }>;
}>;
