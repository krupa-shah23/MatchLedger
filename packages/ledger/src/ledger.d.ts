export type LedgerEntry = {
    readonly txId: string;
    readonly seq: number;
    readonly accountId: string;
    readonly asset: string;
    readonly amount: bigint;
    readonly direction: "DEBIT" | "CREDIT";
    readonly refEventId: string;
};
export type LedgerTx = {
    readonly txId: string;
    readonly refEventId: string;
    readonly legs: readonly {
        readonly accountId: string;
        readonly asset: string;
        readonly amount: bigint;
    }[];
};
export type TradePosting = {
    tradeId: string;
    symbol: string;
    price: bigint;
    quantity: bigint;
    buyerAccountId: string;
    sellerAccountId: string;
    ts?: number;
};
export declare const EXTERNAL = "@EXTERNAL";
export declare const SUSPENSE = "@SUSPENSE";
export declare class UnbalancedTransactionError extends Error {
    constructor(message?: string);
}
export declare class Ledger {
    private readonly ledgerEntries;
    private readonly txIds;
    private nextSeq;
    post(tx: LedgerTx): {
        posted: boolean;
    };
    postDeposit(args: {
        accountId: string;
        asset: string;
        amount: bigint;
        requestId: string;
        refEventId: string;
    }): {
        posted: boolean;
    };
    postTrade(t: TradePosting, refEventId: string): {
        posted: boolean;
    };
    postAdjustment(args: {
        adjustmentId: string;
        accountId: string;
        asset: string;
        amount: bigint;
        refEventId: string;
    }): {
        posted: boolean;
    };
    reverse(txId: string): {
        posted: boolean;
    };
    balance(accountId: string, asset: string): bigint;
    assetTotal(asset: string): bigint;
    entries(): readonly LedgerEntry[];
    checkInvariants(): string[];
    private validateLeg;
}
