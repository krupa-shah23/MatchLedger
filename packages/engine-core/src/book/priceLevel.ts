import type { Side } from "../matching/types.js";

export class OrderNode {
  public readonly orderId: string;
  public readonly accountId: string;
  public readonly side: Side;
  public readonly price: bigint;
  public remaining: bigint;
  public readonly arrivalSeq: bigint;
  public prev: OrderNode | undefined;
  public next: OrderNode | undefined;
  public level: PriceLevel | undefined;

  public constructor(
    orderId: string,
    accountId: string,
    side: Side,
    price: bigint,
    remaining: bigint,
    arrivalSeq: bigint,
  ) {
    this.orderId = orderId;
    this.accountId = accountId;
    this.side = side;
    this.price = price;
    this.remaining = remaining;
    this.arrivalSeq = arrivalSeq;
  }
}

export class PriceLevel implements Iterable<OrderNode> {
  public readonly price: bigint;
  public head: OrderNode | undefined;
  public tail: OrderNode | undefined;
  public totalQuantity = 0n;

  public constructor(price: bigint) {
    this.price = price;
  }

  public append(node: OrderNode): void {
    if (node.level !== undefined || node.prev !== undefined || node.next !== undefined) {
      throw new Error("Order node is already linked");
    }
    node.level = this;
    node.prev = this.tail;
    node.next = undefined;
    if (this.tail === undefined) {
      this.head = node;
    } else {
      this.tail.next = node;
    }
    this.tail = node;
    this.totalQuantity += node.remaining;
  }

  public unlink(node: OrderNode): void {
    if (node.level !== this) {
      throw new Error("Order node does not belong to this level");
    }
    if (node.prev === undefined) {
      this.head = node.next;
    } else {
      node.prev.next = node.next;
    }
    if (node.next === undefined) {
      this.tail = node.prev;
    } else {
      node.next.prev = node.prev;
    }
    this.totalQuantity -= node.remaining;
    node.prev = undefined;
    node.next = undefined;
    node.level = undefined;
  }

  public isEmpty(): boolean {
    return this.head === undefined;
  }

  public *[Symbol.iterator](): Iterator<OrderNode> {
    let current = this.head;
    while (current !== undefined) {
      const next = current.next;
      yield current;
      current = next;
    }
  }
}
