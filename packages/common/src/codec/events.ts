import type { Event } from "@matchledger/engine-core";
import { CURRENT_VERSION } from "./versioning.js";

export function serializeEvent(ev: Event): string {
  const payload: Record<string, unknown> = { v: CURRENT_VERSION };

  payload.type = ev.type;
  payload.engineSeq = ev.engineSeq.toString();
  payload.ts = ev.ts.toString();

  if (ev.type === "ORDER_ACCEPTED") {
    payload.orderId = ev.orderId;
    payload.accountId = ev.accountId;
    payload.side = ev.side;
    payload.orderType = ev.orderType;
    payload.price = ev.price.toString();
    payload.quantity = ev.quantity.toString();
  } else if (ev.type === "ORDER_RESTED") {
    payload.orderId = ev.orderId;
    payload.side = ev.side;
    payload.price = ev.price.toString();
    payload.remaining = ev.remaining.toString();
  } else if (ev.type === "TRADE_EXECUTED") {
    payload.tradeId = ev.tradeId;
    payload.symbol = ev.symbol;
    payload.price = ev.price.toString();
    payload.quantity = ev.quantity.toString();
    payload.takerOrderId = ev.takerOrderId;
    payload.makerOrderId = ev.makerOrderId;
    payload.takerAccountId = ev.takerAccountId;
    payload.makerAccountId = ev.makerAccountId;
    payload.takerSide = ev.takerSide;
  } else if (ev.type === "ORDER_CANCELLED") {
    payload.orderId = ev.orderId;
    payload.remaining = ev.remaining.toString();
    payload.reason = ev.reason;
  } else if (ev.type === "ORDER_REJECTED") {
    payload.orderId = ev.orderId;
    payload.reason = ev.reason;
  } else if (ev.type === "CANCEL_REJECTED") {
    payload.orderId = ev.orderId;
    payload.reason = ev.reason;
  }

  const text = JSON.stringify(payload);
  if (text === undefined) throw new Error("Event serialization failed");
  return text;
}

export function deserializeEvent(json: string): Event {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Not an object");

  const obj = parsed as Record<string, unknown>;
  const v = obj.v;
  if (v !== CURRENT_VERSION) throw new Error(`Invalid version: ${String(v)}`);

  const type = obj.type as string;
  const engineSeq = BigInt(String(obj.engineSeq));
  const ts = BigInt(String(obj.ts));

  if (type === "ORDER_ACCEPTED") {
    return {
      type: "ORDER_ACCEPTED",
      engineSeq,
      ts,
      orderId: String(obj.orderId),
      accountId: String(obj.accountId),
      side: String(obj.side) as "BUY" | "SELL",
      orderType: String(obj.orderType) as "LIMIT" | "IOC",
      price: BigInt(String(obj.price)),
      quantity: BigInt(String(obj.quantity)),
    } as Event;
  } else if (type === "ORDER_RESTED") {
    return {
      type: "ORDER_RESTED",
      engineSeq,
      ts,
      orderId: String(obj.orderId),
      side: String(obj.side) as "BUY" | "SELL",
      price: BigInt(String(obj.price)),
      remaining: BigInt(String(obj.remaining)),
    } as Event;
  } else if (type === "TRADE_EXECUTED") {
    return {
      type: "TRADE_EXECUTED",
      engineSeq,
      ts,
      tradeId: String(obj.tradeId),
      symbol: String(obj.symbol),
      price: BigInt(String(obj.price)),
      quantity: BigInt(String(obj.quantity)),
      takerOrderId: String(obj.takerOrderId),
      makerOrderId: String(obj.makerOrderId),
      takerAccountId: String(obj.takerAccountId),
      makerAccountId: String(obj.makerAccountId),
      takerSide: String(obj.takerSide) as "BUY" | "SELL",
    } as Event;
  } else if (type === "ORDER_CANCELLED") {
    return {
      type: "ORDER_CANCELLED",
      engineSeq,
      ts,
      orderId: String(obj.orderId),
      remaining: BigInt(String(obj.remaining)),
      reason: String(obj.reason) as "USER_REQUEST" | "IOC_REMAINDER",
    } as Event;
  } else if (type === "ORDER_REJECTED") {
    return {
      type: "ORDER_REJECTED",
      engineSeq,
      ts,
      orderId: String(obj.orderId),
      reason: String(obj.reason),
    } as Event;
  } else if (type === "CANCEL_REJECTED") {
    return {
      type: "CANCEL_REJECTED",
      engineSeq,
      ts,
      orderId: String(obj.orderId),
      reason: String(obj.reason) as "ORDER_NOT_RESTING",
    } as Event;
  }

  throw new Error(`Unknown event type: ${String(type)}`);
}
