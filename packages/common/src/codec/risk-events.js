import { CodecError, canonicalStringify, requireBigint, requireEnum, requireNumber, requireOptionalBigint, requireOptionalEnum, requireString, } from "./codec-error.js";
const RISK_SCHEMA_VERSION = 1;
function assertNever(x) {
    throw new Error(`Unhandled RiskEvent variant: ${JSON.stringify(x)}`);
}
function serializeSnapshot(snap) {
    return {
        cash: snap.cash.toString(),
        heldCash: snap.heldCash.toString(),
        availableCash: snap.availableCash.toString(),
        positionQuantity: snap.positionQuantity.toString(),
        heldShares: snap.heldShares.toString(),
        availableShares: snap.availableShares.toString(),
    };
}
function deserializeSnapshot(obj) {
    if (typeof obj !== "object" || obj === null)
        throw new CodecError("snapshot", "expected object");
    const rec = obj;
    return {
        cash: requireBigint(rec, "cash"),
        heldCash: requireBigint(rec, "heldCash"),
        availableCash: requireBigint(rec, "availableCash"),
        positionQuantity: requireBigint(rec, "positionQuantity"),
        heldShares: requireBigint(rec, "heldShares"),
        availableShares: requireBigint(rec, "availableShares"),
    };
}
const RISK_REJECT_REASONS = [
    "INSUFFICIENT_BALANCE",
    "INSUFFICIENT_POSITION",
    "NO_REFERENCE_PRICE",
    "UNKNOWN_ACCOUNT",
    "UNKNOWN_SYMBOL",
    "INVALID_ORDER",
    "SYMBOL_HALTED",
    "ZERO_AMOUNT",
    "HOLD_INVARIANT",
];
const RELEASE_REASONS = ["CANCELLED", "IOC_REMAINDER", "MATCHER_REJECTED", "NEVER_REACHED_MATCHER", "HALT_TIMEOUT"];
export function serializeRiskEvent(evt) {
    const payload = { v: RISK_SCHEMA_VERSION, type: evt.type };
    switch (evt.type) {
        case "AccountOpened":
            payload.accountId = evt.accountId;
            break;
        case "FundsDeposited":
            payload.accountId = evt.accountId;
            payload.asset = evt.asset;
            payload.amount = evt.amount.toString();
            payload.requestId = evt.requestId;
            break;
        case "ReservationPlaced":
            payload.orderId = evt.orderId;
            payload.accountId = evt.accountId;
            payload.symbol = evt.symbol;
            payload.side = evt.side;
            payload.asset = evt.asset;
            payload.amount = evt.amount.toString();
            payload.quantity = evt.quantity.toString();
            payload.priceCap = evt.priceCap.toString();
            break;
        case "OrderAccepted":
            payload.orderId = evt.orderId;
            payload.accountId = evt.accountId;
            payload.symbol = evt.symbol;
            payload.side = evt.side;
            payload.timeInForce = evt.timeInForce;
            payload.price = evt.price.toString();
            payload.quantity = evt.quantity.toString();
            if (evt.referencePrice !== undefined)
                payload.referencePrice = evt.referencePrice.toString();
            if (evt.referenceSource !== undefined)
                payload.referenceSource = evt.referenceSource;
            break;
        case "OrderRejected":
            payload.orderId = evt.orderId;
            payload.accountId = evt.accountId;
            payload.reason = evt.reason;
            if (evt.required !== undefined)
                payload.required = evt.required.toString();
            if (evt.snapshot !== undefined)
                payload.snapshot = serializeSnapshot(evt.snapshot);
            break;
        case "ReservationConverted":
            payload.orderId = evt.orderId;
            payload.accountId = evt.accountId;
            payload.tradeId = evt.tradeId;
            payload.consumed = evt.consumed.toString();
            payload.cost = evt.cost.toString();
            payload.improvement = evt.improvement.toString();
            break;
        case "ReservationReleased":
            payload.orderId = evt.orderId;
            payload.accountId = evt.accountId;
            payload.asset = evt.asset;
            payload.amount = evt.amount.toString();
            payload.quantity = evt.quantity.toString();
            payload.reason = evt.reason;
            break;
        case "AccountAdjusted":
            payload.accountId = evt.accountId;
            payload.asset = evt.asset;
            payload.amount = evt.amount.toString();
            payload.adjustmentId = evt.adjustmentId;
            break;
        case "AdjustmentRejected":
            payload.accountId = evt.accountId;
            payload.asset = evt.asset;
            payload.amount = evt.amount.toString();
            payload.adjustmentId = evt.adjustmentId;
            payload.reason = evt.reason;
            break;
        case "SymbolStatusChanged":
            payload.symbol = evt.symbol;
            payload.status = evt.status;
            if (evt.reason !== undefined)
                payload.reason = evt.reason;
            break;
        case "HaltTimeoutCancelled":
            payload.symbol = evt.symbol;
            payload.count = evt.count;
            payload.incidentStartTs = evt.incidentStartTs;
            payload.ts = evt.ts;
            break;
        case "SweepCandidates":
            payload.candidates = evt.candidates.map((c) => ({ orderId: c.orderId, symbol: c.symbol }));
            break;
        case "DuplicateIgnored":
            payload.kind = evt.kind;
            payload.id = evt.id;
            break;
        case "UnknownOrderIgnored":
            payload.orderId = evt.orderId;
            payload.command = evt.command;
            break;
        default:
            return assertNever(evt);
    }
    return canonicalStringify(payload);
}
export function deserializeRiskEvent(json) {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null)
        throw new CodecError("$", "expected object");
    const obj = parsed;
    if (obj.v !== RISK_SCHEMA_VERSION)
        throw new CodecError("v", `unknown schema version ${JSON.stringify(obj.v)}`);
    const type = requireString(obj, "type");
    switch (type) {
        case "AccountOpened":
            return { type: "AccountOpened", accountId: requireString(obj, "accountId") };
        case "FundsDeposited":
            return {
                type: "FundsDeposited",
                accountId: requireString(obj, "accountId"),
                asset: requireString(obj, "asset"),
                amount: requireBigint(obj, "amount"),
                requestId: requireString(obj, "requestId"),
            };
        case "ReservationPlaced":
            return {
                type: "ReservationPlaced",
                orderId: requireString(obj, "orderId"),
                accountId: requireString(obj, "accountId"),
                symbol: requireString(obj, "symbol"),
                side: requireEnum(obj, "side", ["BUY", "SELL"]),
                asset: requireString(obj, "asset"),
                amount: requireBigint(obj, "amount"),
                quantity: requireBigint(obj, "quantity"),
                priceCap: requireBigint(obj, "priceCap"),
            };
        case "OrderAccepted":
            return {
                type: "OrderAccepted",
                orderId: requireString(obj, "orderId"),
                accountId: requireString(obj, "accountId"),
                symbol: requireString(obj, "symbol"),
                side: requireEnum(obj, "side", ["BUY", "SELL"]),
                timeInForce: requireEnum(obj, "timeInForce", ["GTC", "IOC"]),
                price: requireBigint(obj, "price"),
                quantity: requireBigint(obj, "quantity"),
                referencePrice: requireOptionalBigint(obj, "referencePrice"),
                referenceSource: requireOptionalEnum(obj, "referenceSource", ["LAST_TRADE", "MIDPOINT", "STATIC"]),
            };
        case "OrderRejected":
            return {
                type: "OrderRejected",
                orderId: requireString(obj, "orderId"),
                accountId: requireString(obj, "accountId"),
                reason: requireEnum(obj, "reason", RISK_REJECT_REASONS),
                required: requireOptionalBigint(obj, "required"),
                snapshot: obj.snapshot !== undefined ? deserializeSnapshot(obj.snapshot) : undefined,
            };
        case "ReservationConverted":
            return {
                type: "ReservationConverted",
                orderId: requireString(obj, "orderId"),
                accountId: requireString(obj, "accountId"),
                tradeId: requireString(obj, "tradeId"),
                consumed: requireBigint(obj, "consumed"),
                cost: requireBigint(obj, "cost"),
                improvement: requireBigint(obj, "improvement"),
            };
        case "ReservationReleased":
            return {
                type: "ReservationReleased",
                orderId: requireString(obj, "orderId"),
                accountId: requireString(obj, "accountId"),
                asset: requireString(obj, "asset"),
                amount: requireBigint(obj, "amount"),
                quantity: requireBigint(obj, "quantity"),
                reason: requireEnum(obj, "reason", RELEASE_REASONS),
            };
        case "AccountAdjusted":
            return {
                type: "AccountAdjusted",
                accountId: requireString(obj, "accountId"),
                asset: requireString(obj, "asset"),
                amount: requireBigint(obj, "amount"),
                adjustmentId: requireString(obj, "adjustmentId"),
            };
        case "AdjustmentRejected":
            return {
                type: "AdjustmentRejected",
                accountId: requireString(obj, "accountId"),
                asset: requireString(obj, "asset"),
                amount: requireBigint(obj, "amount"),
                adjustmentId: requireString(obj, "adjustmentId"),
                reason: requireEnum(obj, "reason", RISK_REJECT_REASONS),
            };
        case "SymbolStatusChanged":
            return {
                type: "SymbolStatusChanged",
                symbol: requireString(obj, "symbol"),
                status: requireEnum(obj, "status", ["ACTIVE", "HALTED"]),
                reason: typeof obj.reason === "string" ? obj.reason : undefined,
            };
        case "HaltTimeoutCancelled":
            return {
                type: "HaltTimeoutCancelled",
                symbol: requireString(obj, "symbol"),
                count: requireNumber(obj, "count"),
                incidentStartTs: requireNumber(obj, "incidentStartTs"),
                ts: requireNumber(obj, "ts"),
            };
        case "SweepCandidates": {
            if (!Array.isArray(obj.candidates))
                throw new CodecError("candidates", "expected array");
            const candidates = obj.candidates.map((c) => {
                if (typeof c !== "object" || c === null)
                    throw new CodecError("candidates[]", "expected object");
                const rec = c;
                return { orderId: requireString(rec, "orderId"), symbol: requireString(rec, "symbol") };
            });
            return { type: "SweepCandidates", candidates };
        }
        case "DuplicateIgnored":
            return { type: "DuplicateIgnored", kind: requireEnum(obj, "kind", ["ORDER", "FILL", "DEPOSIT"]), id: requireString(obj, "id") };
        case "UnknownOrderIgnored":
            return { type: "UnknownOrderIgnored", orderId: requireString(obj, "orderId"), command: requireString(obj, "command") };
        default:
            throw new CodecError("type", `unknown event type ${JSON.stringify(type)}`);
    }
}
