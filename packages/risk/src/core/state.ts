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
