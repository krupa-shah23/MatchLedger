export type RestingOrderSnapshot = {
  readonly orderId: string;
  readonly accountId: string;
  readonly side: "BUY" | "SELL";
  readonly price: bigint;
  readonly remaining: bigint;
  readonly arrivalSeq: number;
};

export type LevelSnapshot = {
  readonly price: bigint;
  readonly orders: readonly RestingOrderSnapshot[];
};

export type InstrumentSpec = {
  readonly symbol: string;
  readonly tickSize: bigint;
  readonly lotSize: bigint;
  readonly maxQuantity: bigint;
  readonly maxPrice: bigint;
};

export type SnapshotSpec = InstrumentSpec;

export type BookSnapshot = {
  readonly version: 1;
  readonly symbol: string;
  readonly spec: SnapshotSpec;
  readonly nextArrivalSeq: number;
  readonly nextTradeSeq: number;
  readonly bids: readonly LevelSnapshot[];
  readonly asks: readonly LevelSnapshot[];
};

export type SnapshotErrorReason =
  | "VERSION"
  | "SPEC_MISMATCH"
  | "NEGATIVE_COUNTER"
  | "EMPTY_LEVEL"
  | "LEVEL_ORDER"
  | "PRICE_MISMATCH"
  | "SIDE_MISMATCH"
  | "NON_POSITIVE_REMAINING"
  | "DUPLICATE_ORDER_ID"
  | "ARRIVAL_ORDER"
  | "CROSSED_BOOK"
  | "INVARIANT";

export class InvalidSnapshotError extends Error {
  public constructor(readonly reason: SnapshotErrorReason, detail: string) {
    super(`${reason}: ${detail}`);
    this.name = "InvalidSnapshotError";
  }
}
