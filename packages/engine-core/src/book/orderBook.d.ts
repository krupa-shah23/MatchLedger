import type { BreakerConfig } from "../breaker/types.js";
import type { BookView, LevelView, Side } from "../matching/types.js";
import type { BookSnapshot, InstrumentSpec } from "./snapshot.js";
import { PriceLevel, OrderNode } from "./priceLevel.js";
export interface RestingOrder {
    readonly orderId: string;
    readonly accountId: string;
    readonly side: Side;
    readonly price: bigint;
    readonly remaining: bigint;
    readonly arrivalSeq: bigint;
}
export declare class OrderBook {
    private readonly spec;
    private readonly bids;
    private readonly asks;
    private readonly orders;
    private nextArrivalSeq;
    private nextTradeSeq;
    constructor(spec?: InstrumentSpec);
    addResting(order: RestingOrder): OrderNode;
    cancel(orderId: string): OrderNode | undefined;
    bestBid(): bigint | undefined;
    bestAsk(): bigint | undefined;
    bestLevel(side: Side): PriceLevel | undefined;
    has(orderId: string): boolean;
    reduceMaker(node: OrderNode, quantity: bigint): void;
    view(): BookView;
    depth(side: Side, n: number): LevelView[];
    restingOrders(): RestingOrder[];
    snapshot(): BookSnapshot;
    static restore(spec: InstrumentSpec, snapshot: BookSnapshot, breakerConfig?: BreakerConfig): OrderBook;
    /** Returns violated invariants; an empty array means the book is healthy. */
    checkInvariants(): string[];
    private createSide;
    private sideBook;
    private toSafeNumber;
    private levelViews;
}
