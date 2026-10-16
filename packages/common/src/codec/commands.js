import { CURRENT_VERSION } from "./versioning.js";
export function serializeCommand(cmd) {
    const c = cmd;
    const payload = { v: CURRENT_VERSION };
    if (c.kind === "PLACE") {
        payload.type = "PLACE";
        payload.orderId = c.orderId;
        payload.accountId = c.accountId;
        payload.side = c.side;
        payload.orderType = c.orderType;
        payload.timeInForce = c.timeInForce;
        payload.price = c.price.toString();
        payload.quantity = c.quantity.toString();
    }
    else if (c.kind === "CANCEL") {
        payload.type = "CANCEL";
        payload.orderId = c.orderId;
    }
    else if (c.kind === "TICK") {
        payload.type = "Tick";
        payload.ts = Number(c.ts ?? 0);
    }
    else if (c.type === "Tick") {
        payload.type = "Tick";
        payload.ts = Number(c.ts ?? 0);
    }
    else if (c.type === "HaltSymbol") {
        payload.type = "HaltSymbol";
        payload.reason = c.reason;
        payload.ts = Number(c.ts ?? 0);
    }
    else if (c.type === "ResumeSymbol") {
        payload.type = "ResumeSymbol";
        payload.ts = Number(c.ts ?? 0);
    }
    const text = JSON.stringify(payload);
    if (text === undefined)
        throw new Error("Command serialization failed");
    return text;
}
export function deserializeCommand(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object")
        throw new Error("Not an object");
    const obj = parsed;
    const v = obj.v;
    if (v !== undefined && v !== 1 && v !== CURRENT_VERSION)
        throw new Error(`Invalid schema version: ${String(v)}`);
    const type = obj.type;
    if (type === "PLACE") {
        return {
            kind: "PLACE",
            ts: 0n,
            orderId: String(obj.orderId),
            accountId: String(obj.accountId),
            side: String(obj.side),
            orderType: String(obj.orderType),
            timeInForce: String(obj.timeInForce),
            price: BigInt(String(obj.price)),
            quantity: BigInt(String(obj.quantity)),
        };
    }
    else if (type === "CANCEL") {
        return {
            kind: "CANCEL",
            ts: 0n,
            orderId: String(obj.orderId),
        };
    }
    else if (type === "Tick") {
        return {
            type: "Tick",
            ts: Number(obj.ts ?? 0),
        };
    }
    else if (type === "HaltSymbol") {
        return {
            type: "HaltSymbol",
            reason: String(obj.reason ?? ""),
            ts: Number(obj.ts ?? 0),
        };
    }
    else if (type === "ResumeSymbol") {
        return {
            type: "ResumeSymbol",
            ts: Number(obj.ts ?? 0),
        };
    }
    throw new Error(`Unknown command type: ${String(type)}`);
}
