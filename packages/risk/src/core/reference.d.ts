import type { InstrumentRiskConfig, MarketInput, RiskSide } from "@matchledger/common";
export type ResolvedReference = {
    readonly price: bigint;
    readonly source: "LAST_TRADE" | "MIDPOINT" | "STATIC";
};
export declare function resolveReference(input: MarketInput, nowTs: number, cfg: InstrumentRiskConfig): ResolvedReference | undefined;
export declare function computeMarketLimit(side: RiskSide, reference: bigint, cfg: InstrumentRiskConfig): bigint;
