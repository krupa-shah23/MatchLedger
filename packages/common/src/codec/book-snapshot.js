import { CURRENT_VERSION, getUpcaster, registerUpcaster } from "./versioning.js";
registerUpcaster(1, (value) => {
    if (!value || typeof value !== "object") {
        return { version: 2, breaker: undefined };
    }
    const snapshot = value;
    return {
        ...snapshot,
        version: 2,
        breaker: snapshot.breaker ?? undefined,
    };
});
export function serializeBookSnapshot(snap) {
    const canonical = {};
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
    if (text === undefined)
        throw new Error("Snapshot serialization failed");
    return text;
}
export function deserializeBookSnapshot(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object")
        throw new Error("Not an object");
    const obj = parsed;
    const rawVersion = Number(obj.version ?? obj.v ?? 1);
    const normalized = rawVersion === 1 ? (getUpcaster(1)?.(obj) ?? { ...obj, version: 2, breaker: undefined }) : obj;
    const breaker = normalized.breaker;
    const book = {
        version: Number(normalized.version ?? CURRENT_VERSION),
        symbol: String(normalized.symbol),
        spec: {
            symbol: String(normalized.spec?.symbol),
            tickSize: BigInt(String(normalized.spec?.tickSize)),
            lotSize: BigInt(String(normalized.spec?.lotSize)),
            maxQuantity: BigInt(String(normalized.spec?.maxQuantity)),
            maxPrice: BigInt(String(normalized.spec?.maxPrice)),
        },
        nextArrivalSeq: Number(normalized.nextArrivalSeq ?? 0),
        nextTradeSeq: Number(normalized.nextTradeSeq ?? 0),
        bids: (normalized.bids ?? []).map((l) => ({
            price: BigInt(String(l.price)),
            orders: (l.orders ?? []).map((o) => ({
                orderId: String(o.orderId),
                accountId: String(o.accountId),
                side: String(o.side),
                price: BigInt(String(o.price)),
                remaining: BigInt(String(o.remaining)),
                arrivalSeq: Number(o.arrivalSeq),
            })),
        })),
        asks: (normalized.asks ?? []).map((l) => ({
            price: BigInt(String(l.price)),
            orders: (l.orders ?? []).map((o) => ({
                orderId: String(o.orderId),
                accountId: String(o.accountId),
                side: String(o.side),
                price: BigInt(String(o.price)),
                remaining: BigInt(String(o.remaining)),
                arrivalSeq: Number(o.arrivalSeq),
            })),
        })),
        breaker: breaker === undefined ? undefined : {
            config: {
                windowTrades: Number(breaker.config?.windowTrades ?? 0),
                tripThresholdBps: BigInt(String(breaker.config?.tripThresholdBps ?? 0)),
                resetThresholdBps: BigInt(String(breaker.config?.resetThresholdBps ?? 0)),
                cooldownMs: Number(breaker.config?.cooldownMs ?? 0),
                halfOpenBandBps: BigInt(String(breaker.config?.halfOpenBandBps ?? 0)),
                halfOpenMaxOrdersPerSec: Number(breaker.config?.halfOpenMaxOrdersPerSec ?? 0),
                halfOpenStableMs: Number(breaker.config?.halfOpenStableMs ?? 0),
                maxHaltDurationMs: Number(breaker.config?.maxHaltDurationMs ?? 0),
            },
            state: {
                state: String(breaker.state?.state ?? "CLOSED"),
                manual: Boolean(breaker.state?.manual),
                window: Array.isArray(breaker.state?.window) ? breaker.state.window.map((value) => BigInt(String(value))) : [],
                anchorPrice: breaker.state?.anchorPrice === undefined ? undefined : BigInt(String(breaker.state.anchorPrice)),
                incidentStartTs: breaker.state?.incidentStartTs === undefined ? undefined : Number(breaker.state.incidentStartTs),
                stateSinceTs: Number(breaker.state?.stateSinceTs ?? 0),
                halfOpenBucket: new Map(Array.isArray(breaker.state?.halfOpenBucket) ? breaker.state.halfOpenBucket.map(([key, value]) => [Number(key), Number(value)]) : []),
                forceCancelled: Boolean(breaker.state?.forceCancelled),
            },
        },
    };
    return book;
}
