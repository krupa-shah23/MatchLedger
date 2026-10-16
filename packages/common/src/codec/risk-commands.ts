import type { MarketInput, RiskCommand } from "../risk-types.js";
import {
  CodecError,
  canonicalStringify,
  requireBigint,
  requireEnum,
  requireNumber,
  requireOptionalBigint,
  requireOptionalNumber,
  requireOptionalString,
  requireString,
} from "./codec-error.js";

const RISK_SCHEMA_VERSION = 1;

function assertNever(x: never): never {
  throw new Error(`Unhandled RiskCommand variant: ${JSON.stringify(x)}`);
}

function serializeMarket(market: MarketInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (market.lastTradePrice !== undefined) out.lastTradePrice = market.lastTradePrice.toString();
  if (market.lastTradeTs !== undefined) out.lastTradeTs = market.lastTradeTs;
  if (market.bestBid !== undefined) out.bestBid = market.bestBid.toString();
  if (market.bestAsk !== undefined) out.bestAsk = market.bestAsk.toString();
  return out;
}

function deserializeMarket(obj: unknown): MarketInput {
  if (obj === undefined || obj === null) return {};
  if (typeof obj !== "object") throw new CodecError("market", "expected object");
  const rec = obj as Record<string, unknown>;
  return {
    lastTradePrice: requireOptionalBigint(rec, "lastTradePrice"),
    lastTradeTs: requireOptionalNumber(rec, "lastTradeTs"),
    bestBid: requireOptionalBigint(rec, "bestBid"),
    bestAsk: requireOptionalBigint(rec, "bestAsk"),
  };
}

export function serializeRiskCommand(cmd: RiskCommand): string {
  const payload: Record<string, unknown> = { v: RISK_SCHEMA_VERSION, type: cmd.type };

  switch (cmd.type) {
    case "OpenAccount":
      payload.accountId = cmd.accountId;
      break;
    case "Deposit":
      payload.accountId = cmd.accountId;
      payload.asset = cmd.asset;
      payload.amount = cmd.amount.toString();
      payload.requestId = cmd.requestId;
      break;
    case "SubmitOrder":
      payload.orderId = cmd.orderId;
      payload.accountId = cmd.accountId;
      payload.symbol = cmd.symbol;
      payload.side = cmd.side;
      payload.kind = cmd.kind;
      payload.timeInForce = cmd.timeInForce;
      payload.quantity = cmd.quantity.toString();
      if (cmd.price !== undefined) payload.price = cmd.price.toString();
      payload.market = serializeMarket(cmd.market);
      break;
    case "HaltSymbol":
      payload.symbol = cmd.symbol;
      if (cmd.reason !== undefined) payload.reason = cmd.reason;
      break;
    case "ResumeSymbol":
      payload.symbol = cmd.symbol;
      break;
    case "OrderAcked":
      payload.orderId = cmd.orderId;
      break;
    case "FillApplied":
      payload.orderId = cmd.orderId;
      payload.tradeId = cmd.tradeId;
      payload.price = cmd.price.toString();
      payload.quantity = cmd.quantity.toString();
      break;
    case "OrderClosed":
      payload.orderId = cmd.orderId;
      payload.remaining = cmd.remaining.toString();
      payload.reason = cmd.reason;
      break;
    case "OrderRejectedByMatcher":
      payload.orderId = cmd.orderId;
      payload.reason = cmd.reason;
      break;
    case "ApplyAdjustment":
      payload.adjustmentId = cmd.adjustmentId;
      payload.accountId = cmd.accountId;
      payload.asset = cmd.asset;
      payload.amount = cmd.amount.toString();
      break;
    case "SweepProbe":
      payload.olderThanMs = cmd.olderThanMs;
      break;
    case "ReleaseUnreached":
      payload.orderId = cmd.orderId;
      break;
    default:
      return assertNever(cmd);
  }

  return canonicalStringify(payload);
}

const RELEASE_REASONS = ["CANCELLED", "IOC_REMAINDER", "MATCHER_REJECTED", "NEVER_REACHED_MATCHER", "HALT_TIMEOUT"] as const;

export function deserializeRiskCommand(json: string): RiskCommand {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new CodecError("$", "expected object");
  const obj = parsed as Record<string, unknown>;

  if (obj.v !== RISK_SCHEMA_VERSION) throw new CodecError("v", `unknown schema version ${JSON.stringify(obj.v)}`);
  const type = requireString(obj, "type");

  switch (type) {
    case "OpenAccount":
      return { type: "OpenAccount", accountId: requireString(obj, "accountId") };
    case "Deposit":
      return {
        type: "Deposit",
        accountId: requireString(obj, "accountId"),
        asset: requireString(obj, "asset"),
        amount: requireBigint(obj, "amount"),
        requestId: requireString(obj, "requestId"),
      };
    case "SubmitOrder":
      return {
        type: "SubmitOrder",
        orderId: requireString(obj, "orderId"),
        accountId: requireString(obj, "accountId"),
        symbol: requireString(obj, "symbol"),
        side: requireEnum(obj, "side", ["BUY", "SELL"]),
        kind: requireEnum(obj, "kind", ["LIMIT", "MARKET"]),
        timeInForce: requireEnum(obj, "timeInForce", ["GTC", "IOC"]),
        quantity: requireBigint(obj, "quantity"),
        price: requireOptionalBigint(obj, "price"),
        market: deserializeMarket(obj.market),
      };
    case "HaltSymbol":
      return { type: "HaltSymbol", symbol: requireString(obj, "symbol"), reason: requireOptionalString(obj, "reason") };
    case "ResumeSymbol":
      return { type: "ResumeSymbol", symbol: requireString(obj, "symbol") };
    case "OrderAcked":
      return { type: "OrderAcked", orderId: requireString(obj, "orderId") };
    case "FillApplied":
      return {
        type: "FillApplied",
        orderId: requireString(obj, "orderId"),
        tradeId: requireString(obj, "tradeId"),
        price: requireBigint(obj, "price"),
        quantity: requireBigint(obj, "quantity"),
      };
    case "OrderClosed":
      return {
        type: "OrderClosed",
        orderId: requireString(obj, "orderId"),
        remaining: requireBigint(obj, "remaining"),
        reason: requireEnum(obj, "reason", RELEASE_REASONS),
      };
    case "OrderRejectedByMatcher":
      return { type: "OrderRejectedByMatcher", orderId: requireString(obj, "orderId"), reason: requireString(obj, "reason") };
    case "ApplyAdjustment":
      return {
        type: "ApplyAdjustment",
        adjustmentId: requireString(obj, "adjustmentId"),
        accountId: requireString(obj, "accountId"),
        asset: requireString(obj, "asset"),
        amount: requireBigint(obj, "amount"),
      };
    case "SweepProbe":
      return { type: "SweepProbe", olderThanMs: requireNumber(obj, "olderThanMs") };
    case "ReleaseUnreached":
      return { type: "ReleaseUnreached", orderId: requireString(obj, "orderId") };
    default:
      throw new CodecError("type", `unknown command type ${JSON.stringify(type)}`);
  }
}
