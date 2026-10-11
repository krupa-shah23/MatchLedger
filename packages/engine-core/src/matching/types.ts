import type { BreakerEvent } from "../breaker/types.js";

export type Side = "BUY" | "SELL";
export type OrderType = "LIMIT" | "IOC";
export type TimeInForce = "GTC" | "IOC";

export interface InstrumentConfig {
  readonly symbol: string;
  readonly tickSize: bigint;
  readonly lotSize: bigint;
  readonly maxQuantity: bigint;
  readonly maxPrice: bigint;
}

export interface PlaceOrder {
  readonly kind: "PLACE";
  readonly ts: bigint;
  readonly orderId: string;
  readonly accountId: string;
  readonly side: Side;
  readonly orderType: OrderType;
  readonly timeInForce: TimeInForce;
  readonly price: bigint;
  readonly quantity: bigint;
}

export interface CancelOrder {
  readonly kind: "CANCEL";
  readonly ts: bigint;
  readonly orderId: string;
}

export interface Tick {
  readonly kind: "TICK";
  readonly ts: bigint;
}

export type Command = PlaceOrder | CancelOrder | Tick;

export type RejectReason =
  | "DUPLICATE_ORDER_ID"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "INVALID_TICK"
  | "INVALID_LOT"
  | "EXCEEDS_MAX_QUANTITY"
  | "EXCEEDS_MAX_PRICE";

export type CancelReason = "USER_REQUEST" | "IOC_REMAINDER" | "HALT_TIMEOUT";
export type CancelRejectReason = "ORDER_NOT_RESTING";

export interface OrderAccepted {
  readonly type: "ORDER_ACCEPTED";
  readonly engineSeq: bigint;
  readonly ts: bigint;
  readonly orderId: string;
  readonly accountId: string;
  readonly side: Side;
  readonly orderType: OrderType;
  readonly price: bigint;
  readonly quantity: bigint;
}

export interface OrderRested {
  readonly type: "ORDER_RESTED";
  readonly engineSeq: bigint;
  readonly ts: bigint;
  readonly orderId: string;
  readonly side: Side;
  readonly price: bigint;
  readonly remaining: bigint;
}

export interface TradeExecuted {
  readonly type: "TRADE_EXECUTED";
  readonly engineSeq: bigint;
  readonly ts: bigint;
  readonly tradeId: string;
  readonly symbol: string;
  readonly price: bigint;
  readonly quantity: bigint;
  readonly takerOrderId: string;
  readonly makerOrderId: string;
  readonly takerAccountId: string;
  readonly makerAccountId: string;
  readonly takerSide: Side;
}

export interface OrderCancelled {
  readonly type: "ORDER_CANCELLED";
  readonly engineSeq: bigint;
  readonly ts: bigint;
  readonly orderId: string;
  readonly remaining: bigint;
  readonly reason: CancelReason;
}

export interface OrderRejected {
  readonly type: "ORDER_REJECTED";
  readonly engineSeq: bigint;
  readonly ts: bigint;
  readonly orderId: string;
  readonly reason: RejectReason;
}

export interface CancelRejected {
  readonly type: "CANCEL_REJECTED";
  readonly engineSeq: bigint;
  readonly ts: bigint;
  readonly orderId: string;
  readonly reason: CancelRejectReason;
}

export type Event =
  | OrderAccepted
  | OrderRested
  | TradeExecuted
  | OrderCancelled
  | OrderRejected
  | CancelRejected
  | BreakerEvent;

export interface LevelView {
  readonly price: bigint;
  readonly totalQuantity: bigint;
  readonly orders: readonly {
    readonly orderId: string;
    readonly accountId: string;
    readonly remaining: bigint;
    readonly arrivalSeq: bigint;
  }[];
}

export interface BookView {
  readonly bids: LevelView[];
  readonly asks: LevelView[];
  readonly bidPrices: bigint[];
  readonly askPrices: bigint[];
}
