import type { RiskState } from "../risk-types.js";
import {
  CodecError,
  canonicalStringify,
  requireBigint,
  requireEnum,
  requireNumber,
  requireOptionalBigint,
  requireString,
} from "./codec-error.js";

const RISK_STATE_VERSION = 1;

export function serializeRiskState(state: RiskState): string {
  const payload = {
    version: state.version,
    partition: state.partition,
    instruments: state.instruments.map((i) => ({
      symbol: i.symbol,
      tickSize: i.tickSize.toString(),
      maxPrice: i.maxPrice !== undefined ? i.maxPrice.toString() : undefined,
      protectionBandBps: i.protectionBandBps.toString(),
      maxBandBps: i.maxBandBps.toString(),
      referencePriceTicks: i.referencePriceTicks !== undefined ? i.referencePriceTicks.toString() : undefined,
      maxReferenceAgeMs: i.maxReferenceAgeMs,
    })),
    accounts: state.accounts.map((a) => ({
      accountId: a.accountId,
      cash: a.cash.toString(),
      heldCash: a.heldCash.toString(),
      positions: a.positions.map((p) => ({
        symbol: p.symbol,
        quantity: p.quantity.toString(),
        heldShares: p.heldShares.toString(),
      })),
    })),
    reservations: state.reservations.map((r) => ({
      orderId: r.orderId,
      accountId: r.accountId,
      symbol: r.symbol,
      side: r.side,
      priceCap: r.priceCap.toString(),
      qtyRemaining: r.qtyRemaining.toString(),
      amountRemaining: r.amountRemaining.toString(),
      state: r.state,
      placedTs: r.placedTs,
      placedSeq: r.placedSeq,
      appliedTradeIds: r.appliedTradeIds,
    })),
    decidedOrders: state.decidedOrders,
    seenRequestIds: state.seenRequestIds,
    seenAdjustmentIds: state.seenAdjustmentIds,
    haltedSymbols: state.haltedSymbols,
  };
  return canonicalStringify(payload);
}

export function deserializeRiskState(json: string): RiskState {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new CodecError("$", "expected object");
  const obj = parsed as Record<string, unknown>;

  if (obj.version !== RISK_STATE_VERSION) throw new CodecError("version", `unknown state version ${JSON.stringify(obj.version)}`);
  const partition = requireNumber(obj, "partition");

  if (!Array.isArray(obj.instruments)) throw new CodecError("instruments", "expected array");
  const instruments = obj.instruments.map((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new CodecError("instruments[]", "expected object");
    const rec = raw as Record<string, unknown>;
    return {
      symbol: requireString(rec, "symbol"),
      tickSize: requireBigint(rec, "tickSize"),
      maxPrice: requireOptionalBigint(rec, "maxPrice"),
      protectionBandBps: requireBigint(rec, "protectionBandBps"),
      maxBandBps: requireBigint(rec, "maxBandBps"),
      referencePriceTicks: requireOptionalBigint(rec, "referencePriceTicks"),
      maxReferenceAgeMs: requireNumber(rec, "maxReferenceAgeMs"),
    };
  });

  if (!Array.isArray(obj.accounts)) throw new CodecError("accounts", "expected array");
  const accounts = obj.accounts.map((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new CodecError("accounts[]", "expected object");
    const rec = raw as Record<string, unknown>;
    const positionsRaw = rec.positions;
    if (!Array.isArray(positionsRaw)) throw new CodecError("accounts[].positions", "expected array");
    return {
      accountId: requireString(rec, "accountId"),
      cash: requireBigint(rec, "cash"),
      heldCash: requireBigint(rec, "heldCash"),
      positions: positionsRaw.map((p: unknown) => {
        if (typeof p !== "object" || p === null) throw new CodecError("positions[]", "expected object");
        const prec = p as Record<string, unknown>;
        return {
          symbol: requireString(prec, "symbol"),
          quantity: requireBigint(prec, "quantity"),
          heldShares: requireBigint(prec, "heldShares"),
        };
      }),
    };
  });

  if (!Array.isArray(obj.reservations)) throw new CodecError("reservations", "expected array");
  const reservations = obj.reservations.map((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new CodecError("reservations[]", "expected object");
    const rec = raw as Record<string, unknown>;
    const appliedTradeIdsRaw = rec.appliedTradeIds;
    if (!Array.isArray(appliedTradeIdsRaw) || !appliedTradeIdsRaw.every((x) => typeof x === "string")) {
      throw new CodecError("reservations[].appliedTradeIds", "expected string array");
    }
    return {
      orderId: requireString(rec, "orderId"),
      accountId: requireString(rec, "accountId"),
      symbol: requireString(rec, "symbol"),
      side: requireEnum(rec, "side", ["BUY", "SELL"] as const),
      priceCap: requireBigint(rec, "priceCap"),
      qtyRemaining: requireBigint(rec, "qtyRemaining"),
      amountRemaining: requireBigint(rec, "amountRemaining"),
      state: requireEnum(rec, "state", ["PENDING_ACK", "LIVE"] as const),
      placedTs: requireNumber(rec, "placedTs"),
      placedSeq: requireNumber(rec, "placedSeq"),
      appliedTradeIds: appliedTradeIdsRaw as string[],
    };
  });

  const stringArray = (field: string): string[] => {
    const v = obj[field];
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw new CodecError(field, "expected string array");
    return v as string[];
  };

  return {
    version: 1,
    partition,
    instruments,
    accounts,
    reservations,
    decidedOrders: stringArray("decidedOrders"),
    seenRequestIds: stringArray("seenRequestIds"),
    seenAdjustmentIds: stringArray("seenAdjustmentIds"),
    haltedSymbols: stringArray("haltedSymbols"),
  };
}
