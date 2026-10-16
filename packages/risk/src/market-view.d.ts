import type { MarketInput, ShardOutput } from "@matchledger/common";
export declare class MarketView {
    private readonly books;
    private readonly lastTrade;
    apply(symbol: string, event: ShardOutput["events"][number], ts: number): void;
    snapshotFor(symbol: string): MarketInput;
    private ensureBook;
    private adjustLevel;
    private bestLevel;
}
