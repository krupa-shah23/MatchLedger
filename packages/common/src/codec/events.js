import { CURRENT_VERSION } from "./versioning.js";
export function serializeEvent(ev) {
    const payload = { v: CURRENT_VERSION };
    payload.type = ev.type;
    if ("engineSeq" in ev && ev.engineSeq !== undefined) {
        payload.engineSeq = ev.engineSeq.toString();
    }
    payload.ts = typeof ev.ts === "bigint" ? ev.ts.toString() : ev.ts;
    if (ev.type === "ORDER_ACCEPTED") {
        payload.orderId = ev.orderId;
        payload.accountId = ev.accountId;
        payload.side = ev.side;
        payload.orderType = ev.orderType;
        payload.price = ev.price.toString();
        payload.quantity = ev.quantity.toString();
    }
    else if (ev.type === "ORDER_RESTED") {
        payload.orderId = ev.orderId;
        payload.side = ev.side;
        payload.price = ev.price.toString();
        payload.remaining = ev.remaining.toString();
    }
    else if (ev.type === "TRADE_EXECUTED") {
        payload.tradeId = ev.tradeId;
        payload.symbol = ev.symbol;
        payload.price = ev.price.toString();
        payload.quantity = ev.quantity.toString();
        payload.takerOrderId = ev.takerOrderId;
        payload.makerOrderId = ev.makerOrderId;
        payload.takerAccountId = ev.takerAccountId;
        payload.makerAccountId = ev.makerAccountId;
        payload.takerSide = ev.takerSide;
    }
    else if (ev.type === "ORDER_CANCELLED") {
        payload.orderId = ev.orderId;
        payload.remaining = ev.remaining.toString();
        payload.reason = ev.reason;
    }
    else if (ev.type === "ORDER_REJECTED") {
        payload.orderId = ev.orderId;
        payload.reason = ev.reason;
    }
    else if (ev.type === "CANCEL_REJECTED") {
        payload.orderId = ev.orderId;
        payload.reason = ev.reason;
    }
    else if (ev.type === "BreakerTripped") {
        payload.reason = ev.reason;
        payload.volatilityBps = ev.volatilityBps === undefined ? undefined : ev.volatilityBps.toString();
        payload.thresholdBps = ev.thresholdBps === undefined ? undefined : ev.thresholdBps.toString();
        payload.anchorPrice = ev.anchorPrice === undefined ? undefined : ev.anchorPrice.toString();
        payload.incidentStartTs = ev.incidentStartTs;
        payload.detail = ev.detail;
    }
    else if (ev.type === "BreakerHalfOpened") {
        payload.trigger = ev.trigger;
    }
    else if (ev.type === "BreakerClosed") {
        payload.incidentDurationMs = ev.incidentDurationMs;
    }
    else if (ev.type === "BreakerCommandIgnored") {
        payload.command = ev.command;
        payload.reason = ev.reason;
    }
    else if (ev.type === "HaltTimeoutCancelled") {
        payload.count = ev.count;
        payload.incidentStartTs = ev.incidentStartTs;
    }
    const text = JSON.stringify(payload);
    if (text === undefined)
        throw new Error("Event serialization failed");
    return text;
}
export function deserializeEvent(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object")
        throw new Error("Not an object");
    const obj = parsed;
    const v = obj.v;
    if (v !== undefined && v !== 1 && v !== CURRENT_VERSION)
        throw new Error(`Invalid version: ${String(v)}`);
    const type = obj.type;
    if (type === "ORDER_ACCEPTED") {
        return {
            type: "ORDER_ACCEPTED",
            engineSeq: BigInt(String(obj.engineSeq)),
            ts: BigInt(String(obj.ts)),
            orderId: String(obj.orderId),
            accountId: String(obj.accountId),
            side: String(obj.side),
            orderType: String(obj.orderType),
            price: BigInt(String(obj.price)),
            quantity: BigInt(String(obj.quantity)),
        };
    }
    else if (type === "ORDER_RESTED") {
        return {
            type: "ORDER_RESTED",
            engineSeq: BigInt(String(obj.engineSeq)),
            ts: BigInt(String(obj.ts)),
            orderId: String(obj.orderId),
            side: String(obj.side),
            price: BigInt(String(obj.price)),
            remaining: BigInt(String(obj.remaining)),
        };
    }
    else if (type === "TRADE_EXECUTED") {
        return {
            type: "TRADE_EXECUTED",
            engineSeq: BigInt(String(obj.engineSeq)),
            ts: BigInt(String(obj.ts)),
            tradeId: String(obj.tradeId),
            symbol: String(obj.symbol),
            price: BigInt(String(obj.price)),
            quantity: BigInt(String(obj.quantity)),
            takerOrderId: String(obj.takerOrderId),
            makerOrderId: String(obj.makerOrderId),
            takerAccountId: String(obj.takerAccountId),
            makerAccountId: String(obj.makerAccountId),
            takerSide: String(obj.takerSide),
        };
    }
    else if (type === "ORDER_CANCELLED") {
        return {
            type: "ORDER_CANCELLED",
            engineSeq: BigInt(String(obj.engineSeq)),
            ts: BigInt(String(obj.ts)),
            orderId: String(obj.orderId),
            remaining: BigInt(String(obj.remaining)),
            reason: String(obj.reason),
        };
    }
    else if (type === "ORDER_REJECTED") {
        return {
            type: "ORDER_REJECTED",
            engineSeq: BigInt(String(obj.engineSeq)),
            ts: BigInt(String(obj.ts)),
            orderId: String(obj.orderId),
            reason: String(obj.reason),
        };
    }
    else if (type === "CANCEL_REJECTED") {
        return {
            type: "CANCEL_REJECTED",
            engineSeq: BigInt(String(obj.engineSeq)),
            ts: BigInt(String(obj.ts)),
            orderId: String(obj.orderId),
            reason: String(obj.reason),
        };
    }
    else if (type === "BreakerTripped") {
        return {
            type: "BreakerTripped",
            reason: String(obj.reason),
            volatilityBps: obj.volatilityBps === undefined ? undefined : BigInt(String(obj.volatilityBps)),
            thresholdBps: obj.thresholdBps === undefined ? undefined : BigInt(String(obj.thresholdBps)),
            anchorPrice: obj.anchorPrice === undefined ? undefined : BigInt(String(obj.anchorPrice)),
            incidentStartTs: Number(obj.incidentStartTs ?? 0),
            detail: obj.detail === undefined ? undefined : String(obj.detail),
            ts: Number(obj.ts ?? 0),
        };
    }
    else if (type === "BreakerHalfOpened") {
        return {
            type: "BreakerHalfOpened",
            trigger: String(obj.trigger),
            ts: Number(obj.ts ?? 0),
        };
    }
    else if (type === "BreakerClosed") {
        return {
            type: "BreakerClosed",
            incidentDurationMs: Number(obj.incidentDurationMs ?? 0),
            ts: Number(obj.ts ?? 0),
        };
    }
    else if (type === "BreakerCommandIgnored") {
        return {
            type: "BreakerCommandIgnored",
            command: String(obj.command),
            reason: String(obj.reason ?? ""),
            ts: Number(obj.ts ?? 0),
        };
    }
    else if (type === "HaltTimeoutCancelled") {
        return {
            type: "HaltTimeoutCancelled",
            count: Number(obj.count ?? 0),
            incidentStartTs: Number(obj.incidentStartTs ?? 0),
            ts: Number(obj.ts ?? 0),
        };
    }
    throw new Error(`Unknown event type: ${String(type)}`);
}
