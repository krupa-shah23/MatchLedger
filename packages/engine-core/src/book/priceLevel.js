export class OrderNode {
    orderId;
    accountId;
    side;
    price;
    remaining;
    arrivalSeq;
    prev;
    next;
    level;
    constructor(orderId, accountId, side, price, remaining, arrivalSeq) {
        this.orderId = orderId;
        this.accountId = accountId;
        this.side = side;
        this.price = price;
        this.remaining = remaining;
        this.arrivalSeq = arrivalSeq;
    }
}
export class PriceLevel {
    price;
    head;
    tail;
    totalQuantity = 0n;
    constructor(price) {
        this.price = price;
    }
    append(node) {
        if (node.level !== undefined || node.prev !== undefined || node.next !== undefined) {
            throw new Error("Order node is already linked");
        }
        node.level = this;
        node.prev = this.tail;
        node.next = undefined;
        if (this.tail === undefined) {
            this.head = node;
        }
        else {
            this.tail.next = node;
        }
        this.tail = node;
        this.totalQuantity += node.remaining;
    }
    unlink(node) {
        if (node.level !== this) {
            throw new Error("Order node does not belong to this level");
        }
        if (node.prev === undefined) {
            this.head = node.next;
        }
        else {
            node.prev.next = node.next;
        }
        if (node.next === undefined) {
            this.tail = node.prev;
        }
        else {
            node.next.prev = node.prev;
        }
        this.totalQuantity -= node.remaining;
        node.prev = undefined;
        node.next = undefined;
        node.level = undefined;
    }
    isEmpty() {
        return this.head === undefined;
    }
    *[Symbol.iterator]() {
        let current = this.head;
        while (current !== undefined) {
            const next = current.next;
            yield current;
            current = next;
        }
    }
}
