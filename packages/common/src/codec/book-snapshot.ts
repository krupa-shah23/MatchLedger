/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BookSnapshot } from "@matchledger/engine-core";
import { CURRENT_VERSION, getUpcaster, registerUpcaster } from "./versioning.js";

registerUpcaster(1, (value: unknown) => {
  if (!value || typeof value !== "object") {
    return { version: 2, breaker: undefined };
  }
  const snapshot = value as Record<string, unknown>;
  return {
    ...snapshot,
    version: 2,
    breaker: snapshot.breaker ?? undefined,
  };
});

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
  canonical.version = snap.version ?? CURRENT_VERSION;
  if (snap.breaker !== undefined) {
    canonical.breaker = {
      config: {
        cooldownMs: snap.breaker.config.cooldownMs,
        halfOpenBandBps: snap.breaker.config.halfOpenBandBps.toString(),
        halfOpenMaxOrdersPerSec: snap.breaker.config.halfOpenMaxOrdersPerSec,
        halfOpenStableMs: snap.breaker.config.halfOpenStableMs,
        maxHaltDurationMs: snap.breaker.config.maxHaltDurationMs,
        resetThresholdBps: snap.breaker.config.resetThresholdBps.toString(),
        tripThresholdBps: snap.breaker.config.tripThresholdBps.toString(),
        windowTrades: snap.breaker.config.windowTrades,
      },
      state: {
        anchorPrice: snap.breaker.state.anchorPrice === undefined ? undefined : snap.breaker.state.anchorPrice.toString(),
        forceCancelled: snap.breaker.state.forceCancelled,
        halfOpenBucket: Array.from(snap.breaker.state.halfOpenBucket.entries()),
        incidentStartTs: snap.breaker.state.incidentStartTs,
        manual: snap.breaker.state.manual,
        state: snap.breaker.state.state,
        stateSinceTs: snap.breaker.state.stateSinceTs,
        window: snap.breaker.state.window.map((price) => price.toString()),
      },
    };
  }

  const text = JSON.stringify(canonical);
  if (text === undefined) throw new Error("Snapshot serialization failed");
  return text;
}

export function deserializeBookSnapshot(json: string): BookSnapshot {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Not an object");

  const obj = parsed as Record<string, unknown>;
  const rawVersion = Number(obj.version ?? obj.v ?? 1);
  const normalized = rawVersion === 1 ? (getUpcaster(1)?.(obj) ?? { ...obj, version: 2, breaker: undefined }) : obj;

  const breaker = (normalized as any).breaker;
  const book: BookSnapshot = {
    version: Number((normalized as any).version ?? CURRENT_VERSION) as 1 | 2,
    symbol: String((normalized as any).symbol),
    spec: {
      symbol: String((normalized as any).spec?.symbol),
      tickSize: BigInt(String((normalized as any).spec?.tickSize)),
      lotSize: BigInt(String((normalized as any).spec?.lotSize)),
      maxQuantity: BigInt(String((normalized as any).spec?.maxQuantity)),
      maxPrice: BigInt(String((normalized as any).spec?.maxPrice)),
    },
    nextArrivalSeq: Number((normalized as any).nextArrivalSeq ?? 0),
    nextTradeSeq: Number((normalized as any).nextTradeSeq ?? 0),
    bids: ((normalized as any).bids ?? []).map((l: any) => ({
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
    asks: ((normalized as any).asks ?? []).map((l: any) => ({
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
    breaker: breaker === undefined ? undefined : {
      config: {
        windowTrades: Number((breaker as any).config?.windowTrades ?? 0),
        tripThresholdBps: BigInt(String((breaker as any).config?.tripThresholdBps ?? 0)),
        resetThresholdBps: BigInt(String((breaker as any).config?.resetThresholdBps ?? 0)),
        cooldownMs: Number((breaker as any).config?.cooldownMs ?? 0),
        halfOpenBandBps: BigInt(String((breaker as any).config?.halfOpenBandBps ?? 0)),
        halfOpenMaxOrdersPerSec: Number((breaker as any).config?.halfOpenMaxOrdersPerSec ?? 0),
        halfOpenStableMs: Number((breaker as any).config?.halfOpenStableMs ?? 0),
        maxHaltDurationMs: Number((breaker as any).config?.maxHaltDurationMs ?? 0),
      },
      state: {
        state: String((breaker as any).state?.state ?? "CLOSED") as "CLOSED" | "OPEN" | "HALF_OPEN",
        manual: Boolean((breaker as any).state?.manual),
        window: Array.isArray((breaker as any).state?.window) ? (breaker as any).state.window.map((value: unknown) => BigInt(String(value))) : [],
        anchorPrice: (breaker as any).state?.anchorPrice === undefined ? undefined : BigInt(String((breaker as any).state.anchorPrice)),
        incidentStartTs: (breaker as any).state?.incidentStartTs === undefined ? undefined : Number((breaker as any).state.incidentStartTs),
        stateSinceTs: Number((breaker as any).state?.stateSinceTs ?? 0),
        halfOpenBucket: new Map(Array.isArray((breaker as any).state?.halfOpenBucket) ? (breaker as any).state.halfOpenBucket.map(([key, value]: [unknown, unknown]) => [Number(key), Number(value)]) : []),
        forceCancelled: Boolean((breaker as any).state?.forceCancelled),
      },
    },
  };

  return book;
}
