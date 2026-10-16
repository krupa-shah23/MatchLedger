import type { Side } from "../matching/types.js";
export declare class SortedPrices {
    private readonly prices;
    private readonly descending;
    constructor(side: Side);
    insert(price: bigint): void;
    remove(price: bigint): void;
    best(): bigint | undefined;
    has(price: bigint): boolean;
    toArray(): bigint[];
    private search;
}
