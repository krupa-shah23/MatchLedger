import { civilFromDays } from "./dates.js";
export function classify(args) {
    const { cutoffTs, settlementLagDays, internalTrades, statementRows } = args;
    const internalById = new Map();
    for (const trade of internalTrades) {
        internalById.set(trade.tradeId, trade);
    }
    const externalById = new Map();
    for (const row of statementRows) {
        const list = externalById.get(row.tradeId) ?? [];
        list.push(row);
        externalById.set(row.tradeId, list);
    }
    const breaks = [];
    for (const [tradeId, internalTrade] of [...internalById.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        const rows = externalById.get(tradeId) ?? [];
        if (rows.length === 0) {
            breaks.push({ tradeId, type: "MISSING_EXTERNAL", internalQuantity: internalTrade.quantity, internalPrice: internalTrade.price, internalSettlement: settlementDate(internalTrade.ts, settlementLagDays), internalTs: internalTrade.ts });
            continue;
        }
        const first = rows[0];
        if (first === undefined) {
            continue;
        }
        const externalQty = parseQuantity(first.quantity);
        const externalPrice = parsePrice(first.price, args.priceDecimals);
        if (rows.length > 1) {
            breaks.push({ tradeId, type: "DUPLICATE", count: rows.length });
        }
        if (Number(first.tradeTs) > cutoffTs) {
            breaks.push({ tradeId, type: "LATE", externalTs: Number(first.tradeTs) });
        }
        if (externalQty !== undefined && externalQty !== internalTrade.quantity) {
            breaks.push({ tradeId, type: "QUANTITY_MISMATCH", internalQuantity: internalTrade.quantity, externalQuantity: externalQty });
        }
        if (externalPrice !== undefined && externalPrice !== internalTrade.price) {
            breaks.push({ tradeId, type: "PRICE_MISMATCH", internalPrice: internalTrade.price, externalPrice: externalPrice });
        }
        const internalSettlement = settlementDate(internalTrade.ts, settlementLagDays);
        if (first.settlementDate !== internalSettlement) {
            breaks.push({ tradeId, type: "SETTLEMENT_MISMATCH", internalSettlement, externalSettlement: first.settlementDate });
        }
    }
    for (const [tradeId, rows] of [...externalById.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        if (!internalById.has(tradeId)) {
            breaks.push({ tradeId, type: "MISSING_INTERNAL", count: rows.length });
        }
    }
    return breaks.sort((left, right) => left.tradeId.localeCompare(right.tradeId) || left.type.localeCompare(right.type));
}
function parseQuantity(value) {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) {
        return undefined;
    }
    return BigInt(trimmed);
}
function parsePrice(value, priceDecimals) {
    const raw = value.trim();
    if (raw.length === 0) {
        return undefined;
    }
    const maybe = raw.replace(/(^\+|^\-)/, "");
    if (!/^\d+(\.\d+)?$/.test(maybe)) {
        return undefined;
    }
    const [whole, fraction = ""] = maybe.split(".");
    if (fraction.length > priceDecimals) {
        return undefined;
    }
    const normalized = fraction.padEnd(priceDecimals, "0");
    const sign = raw.startsWith("-") ? -1n : 1n;
    const scaled = BigInt(whole || "0") * 10n ** BigInt(priceDecimals) + (normalized === "" ? 0n : BigInt(normalized));
    return sign * scaled;
}
function settlementDate(ts, lagDays) {
    const timeMs = BigInt(Math.trunc(ts));
    const days = floorDivBigInt(timeMs, 86400000n) + BigInt(lagDays);
    const civil = civilFromDays(days);
    return `${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`;
}
function floorDivBigInt(value, divisor) {
    const quotient = value / divisor;
    const remainder = value % divisor;
    if (remainder === 0n) {
        return quotient;
    }
    if ((value < 0n) !== (divisor < 0n)) {
        return quotient - 1n;
    }
    return quotient;
}
