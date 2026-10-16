import type { RiskCommand, RiskSide, ShardOutput } from "@matchledger/common";
import { SeqDeduper } from "@matchledger/common";
import type { MarketView } from "./market-view.js";
export type OrderOwner = {
    readonly accountId: string;
    readonly symbol: string;
    readonly side: RiskSide;
};
export type AccountNotice = {
    readonly accountId: string;
    readonly command: RiskCommand;
};
export type TradePosting = {
    readonly tradeId: string;
    readonly symbol: string;
    readonly price: bigint;
    readonly quantity: bigint;
    readonly buyerAccountId: string;
    readonly sellerAccountId: string;
    readonly ts?: number;
};
export type RouterResult = {
    readonly notices: readonly AccountNotice[];
    readonly trades: readonly TradePosting[];
    readonly ignoredOrders: number;
};
export declare class EngineEventRouter {
    readonly counters: {
        duplicateOutputs: number;
        unknownOrderEvents: number;
    };
    private readonly owners;
    private readonly sweepCancels;
    private readonly deduper;
    private readonly localSeq;
    constructor(opts: {
        readonly marketView: MarketView;
        readonly dedupe?: SeqDeduper;
    });
    readonly marketView: MarketView;
    registerOrder(orderId: string, owner: OrderOwner): void;
    markSweepCancel(orderId: string): void;
    ownerOf(orderId: string): OrderOwner | undefined;
    onShardOutputs(outputs: readonly ShardOutput[]): RouterResult;
    private acceptOutput;
}
