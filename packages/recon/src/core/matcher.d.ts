export type BreakType = "MISSING_EXTERNAL" | "MISSING_INTERNAL" | "QUANTITY_MISMATCH" | "PRICE_MISMATCH" | "SETTLEMENT_MISMATCH" | "DUPLICATE" | "LATE";
export type InternalTradeRecord = Readonly<{
    readonly tradeId: string;
    readonly symbol: string;
    readonly quantity: bigint;
    readonly price: bigint;
    readonly buyerAccountId: string;
    readonly sellerAccountId: string;
    readonly ts: number;
}>;
export type StatementRow = Readonly<{
    readonly tradeId: string;
    readonly symbol: string;
    readonly quantity: string;
    readonly price: string;
    readonly tradeTs: string;
    readonly settlementDate: string;
}>;
export type BreakDefinition = Readonly<{
    readonly tradeId: string;
    readonly type: BreakType;
    readonly count?: number;
    readonly internalQuantity?: bigint;
    readonly externalQuantity?: bigint;
    readonly internalPrice?: bigint;
    readonly externalPrice?: bigint;
    readonly internalSettlement?: string;
    readonly externalSettlement?: string;
    readonly internalTs?: number;
    readonly externalTs?: number;
}>;
export declare function classify(args: {
    readonly cutoffTs: number;
    readonly priceDecimals: number;
    readonly settlementLagDays: number;
    readonly internalTrades: readonly InternalTradeRecord[];
    readonly statementRows: readonly StatementRow[];
}): readonly BreakDefinition[];
