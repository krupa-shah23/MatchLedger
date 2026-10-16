import type { Side } from "../matching/types.js";
export declare class OrderNode {
    readonly orderId: string;
    readonly accountId: string;
    readonly side: Side;
    readonly price: bigint;
    remaining: bigint;
    readonly arrivalSeq: bigint;
    prev: OrderNode | undefined;
    next: OrderNode | undefined;
    level: PriceLevel | undefined;
    constructor(orderId: string, accountId: string, side: Side, price: bigint, remaining: bigint, arrivalSeq: bigint);
}
export declare class PriceLevel implements Iterable<OrderNode> {
    readonly price: bigint;
    head: OrderNode | undefined;
    tail: OrderNode | undefined;
    totalQuantity: bigint;
    constructor(price: bigint);
    append(node: OrderNode): void;
    unlink(node: OrderNode): void;
    isEmpty(): boolean;
    [Symbol.iterator](): Iterator<OrderNode>;
}
