/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BookSnapshot } from "@matchledger/engine-core";
import { CURRENT_VERSION } from "./versioning.js";

export function serializeBookSnapshot(snap: BookSnapshot): string {
  const canonical: Record<string, unknown> = {};
  canonical.asks = snap.asks.map((l) => ({
    orders: l.orders.map((o) => ({
      accountId: o.accountId,
      arrivalSeq: o.arrivalSeq,
      orderId: o.orderId,
      price: o.price.toString(),
      remaining: o.remaining.toString(),
      side: o.side,
    })),
    price: l.price.toString(),
  }));
  canonical.bids = snap.bids.map((l) => ({
    orders: l.orders.map((o) => ({
      accountId: o.accountId,
      arrivalSeq: o.arrivalSeq,
      orderId: o.orderId,
      price: o.price.toString(),
      remaining: o.remaining.toString(),
      side: o.side,
    })),
    price: l.price.toString(),
  }));
  canonical.nextArrivalSeq = snap.nextArrivalSeq;
  canonical.nextTradeSeq = snap.nextTradeSeq;
  canonical.spec = {
    lotSize: snap.spec.lotSize.toString(),
    maxPrice: snap.spec.maxPrice.toString(),
    maxQuantity: snap.spec.maxQuantity.toString(),
    symbol: snap.spec.symbol,
    tickSize: snap.spec.tickSize.toString(),
  };
  canonical.symbol = snap.symbol;
  canonical.v = CURRENT_VERSION;
  canonical.version = snap.version;

  const text = JSON.stringify(canonical);
  if (text === undefined) throw new Error("Snapshot serialization failed");
  return text;
}

export function deserializeBookSnapshot(json: string): BookSnapshot {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Not an object");

  const obj = parsed as Record<string, unknown>;

  return {
    version: Number(obj.version) as 1,
    symbol: String(obj.symbol),
    spec: {
      symbol: String((obj.spec as any)?.symbol),
      tickSize: BigInt(String((obj.spec as any)?.tickSize)),
      lotSize: BigInt(String((obj.spec as any)?.lotSize)),
      maxQuantity: BigInt(String((obj.spec as any)?.maxQuantity)),
      maxPrice: BigInt(String((obj.spec as any)?.maxPrice)),
    },
    nextArrivalSeq: Number(obj.nextArrivalSeq),
    nextTradeSeq: Number(obj.nextTradeSeq),
    bids: ((obj.bids as any) ?? []).map((l: any) => ({
      price: BigInt(String(l.price)),
      orders: (l.orders ?? []).map((o: any) => ({
        orderId: String(o.orderId),
        accountId: String(o.accountId),
        side: String(o.side) as "BUY" | "SELL",
        price: BigInt(String(o.price)),
        remaining: BigInt(String(o.remaining)),
        arrivalSeq: Number(o.arrivalSeq),
      })),
    })),
    asks: ((obj.asks as any) ?? []).map((l: any) => ({
      price: BigInt(String(l.price)),
      orders: (l.orders ?? []).map((o: any) => ({
        orderId: String(o.orderId),
        accountId: String(o.accountId),
        side: String(o.side) as "BUY" | "SELL",
        price: BigInt(String(o.price)),
        remaining: BigInt(String(o.remaining)),
        arrivalSeq: Number(o.arrivalSeq),
      })),
    })),
  } as BookSnapshot;
}
