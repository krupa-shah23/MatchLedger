import type { InstrumentRiskConfig, MarketInput, RiskSide } from "@matchledger/common";

import { ceilDiv, ceilToTick, floorDiv, floorToTick } from "./money.js";

export type ResolvedReference = {
  readonly price: bigint;
  readonly source: "LAST_TRADE" | "MIDPOINT" | "STATIC";
};

export function resolveReference(
  input: MarketInput,
  nowTs: number,
  cfg: InstrumentRiskConfig,
): ResolvedReference | undefined {
  if (input.lastTradePrice !== undefined && input.lastTradeTs !== undefined) {
    const age = nowTs - input.lastTradeTs;
    if (age <= cfg.maxReferenceAgeMs) {
      return { price: input.lastTradePrice, source: "LAST_TRADE" };
    }
  }

  if (input.bestBid !== undefined && input.bestAsk !== undefined) {
    const midpoint = (input.bestBid + input.bestAsk) / 2n;
    return { price: midpoint, source: "MIDPOINT" };
  }

  if (cfg.referencePriceTicks !== undefined && cfg.referencePriceTicks > 0n) {
    return { price: cfg.referencePriceTicks, source: "STATIC" };
  }

  return undefined;
}

export function computeMarketLimit(side: RiskSide, reference: bigint, cfg: InstrumentRiskConfig): bigint {
  if (cfg.protectionBandBps < 0n || cfg.protectionBandBps >= 10_000n || cfg.maxBandBps < 0n || cfg.maxBandBps >= 10_000n) {
    throw new RangeError("band must satisfy 0 <= band < 10_000");
  }

  const band = cfg.protectionBandBps < cfg.maxBandBps ? cfg.protectionBandBps : cfg.maxBandBps;

  if (side === "BUY") {
    const cappedReference = ceilDiv(reference * (10_000n + band), 10_000n);
    const tickRounded = ceilToTick(cappedReference, cfg.tickSize);
    if (cfg.maxPrice !== undefined && tickRounded > cfg.maxPrice) {
      return cfg.maxPrice;
    }
    return tickRounded;
  }

  const floorReference = floorDiv(reference * (10_000n - band), 10_000n);
  const tickRounded = floorToTick(floorReference, cfg.tickSize);
  return tickRounded < cfg.tickSize ? cfg.tickSize : tickRounded;
}
