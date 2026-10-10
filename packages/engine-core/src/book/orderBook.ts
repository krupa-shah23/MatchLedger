import type { BookView, LevelView, Side } from "../matching/types.js";
import type { BookSnapshot, InstrumentSpec } from "./snapshot.js";
import { PriceLevel, OrderNode } from "./priceLevel.js";
import { SortedPrices } from "./sortedPrices.js";

export interface RestingOrder {
  readonly orderId: string;
  readonly accountId: string;
  readonly side: Side;
  readonly price: bigint;
  readonly remaining: bigint;
  readonly arrivalSeq: bigint;
}

interface SideBook {
  readonly levels: Map<bigint, PriceLevel>;
  readonly prices: SortedPrices;
}

export class OrderBook {
  private readonly bids: SideBook = this.createSide("BUY");
  private readonly asks: SideBook = this.createSide("SELL");
  private readonly orders = new Map<string, OrderNode>();

  public addResting(order: RestingOrder): OrderNode {
    if (this.orders.has(order.orderId)) {
      throw new Error(`Order ${order.orderId} already exists`);
    }
    const node = new OrderNode(
      order.orderId,
      order.accountId,
      order.side,
      order.price,
      order.remaining,
      order.arrivalSeq,
    );
    const sideBook = this.sideBook(order.side);
    let level = sideBook.levels.get(order.price);
    if (level === undefined) {
      level = new PriceLevel(order.price);
      sideBook.levels.set(order.price, level);
      sideBook.prices.insert(order.price);
    }
    level.append(node);
    this.orders.set(order.orderId, node);
    return node;
  }

  public cancel(orderId: string): OrderNode | undefined {
    const node = this.orders.get(orderId);
    if (node === undefined) {
      return undefined;
    }
    const level = node.level;
    if (level === undefined) {
      throw new Error("Indexed order is not linked");
    }
    level.unlink(node);
    this.orders.delete(orderId);
    if (level.isEmpty()) {
      const sideBook = this.sideBook(node.side);
      sideBook.levels.delete(node.price);
      sideBook.prices.remove(node.price);
    }
    return node;
  }

  public bestBid(): bigint | undefined {
    return this.bids.prices.best();
  }

  public bestAsk(): bigint | undefined {
    return this.asks.prices.best();
  }

  public bestLevel(side: Side): PriceLevel | undefined {
    const sideBook = this.sideBook(side);
    const price = sideBook.prices.best();
    return price === undefined ? undefined : sideBook.levels.get(price);
  }

  public has(orderId: string): boolean {
    return this.orders.has(orderId);
  }

  public reduceMaker(node: OrderNode, quantity: bigint): void {
    if (quantity <= 0n || quantity > node.remaining || node.level === undefined) {
      throw new Error("Invalid maker reduction");
    }
    node.remaining -= quantity;
    node.level.totalQuantity -= quantity;
  }

  public view(): BookView {
    const bidPrices = this.bids.prices.toArray();
    const askPrices = this.asks.prices.toArray();
    return {
      bids: this.levelViews(this.bids, bidPrices.slice().reverse()),
      asks: this.levelViews(this.asks, askPrices.slice().reverse()),
      bidPrices,
      askPrices,
    };
  }

  public depth(side: Side, n: number): LevelView[] {
    const view = this.view();
    return (side === "BUY" ? view.bids : view.asks).slice(0, Math.max(0, n));
  }

  public restingOrders(): RestingOrder[] {
    const out: RestingOrder[] = [];
    for (const node of this.orders.values()) {
      out.push({ orderId: node.orderId, accountId: node.accountId, side: node.side, price: node.price, remaining: node.remaining, arrivalSeq: node.arrivalSeq });
    }
    return out;
  }

  public snapshot(): BookSnapshot {
    throw new Error("OrderBook.snapshot/restore: hand-written (docs/WEEK-5.md 4.6)");
  }

  public static restore(spec: InstrumentSpec, snapshot: BookSnapshot): OrderBook {
    void spec;
    void snapshot;
    throw new Error("OrderBook.snapshot/restore: hand-written (docs/WEEK-5.md 4.6)");
  }

  /** Returns violated invariants; an empty array means the book is healthy. */
  public checkInvariants(): string[] {
    const errors: string[] = [];
    let linked = 0;
    for (const [name, sb] of [["bids", this.bids], ["asks", this.asks]] as const) {
      const prices = sb.prices.toArray();
      const better = (a: bigint, b: bigint): boolean => (name === "bids" ? a > b : a < b);
      prices.forEach((price, i) => {
        const prev = prices[i - 1];
        if (prev !== undefined && !better(price, prev)) errors.push(`${name}: prices not strictly ordered worst to best at ${price}`);
      });
      if (prices.length !== sb.levels.size) errors.push(`${name}: price array size ${prices.length} != levels ${sb.levels.size}`);
      for (const [price, level] of sb.levels) {
        if (!sb.prices.has(price)) errors.push(`${name}: level ${price} missing from price array`);
        if (level.isEmpty()) errors.push(`${name}: empty level ${price}`);
        let sum = 0n;
        let prevNode: OrderNode | undefined;
        for (const node of level) {
          linked += 1;
          sum += node.remaining;
          if (node.remaining <= 0n) errors.push(`${node.orderId}: non-positive remaining`);
          if (node.prev !== prevNode) errors.push(`${node.orderId}: prev pointer inconsistent`);
          if (prevNode !== undefined && prevNode.arrivalSeq >= node.arrivalSeq) errors.push(`${node.orderId}: FIFO order violated`);
          if (node.level !== level || node.price !== price) errors.push(`${node.orderId}: wrong level`);
          if (this.orders.get(node.orderId) !== node) errors.push(`${node.orderId}: not in index`);
          prevNode = node;
        }
        if (level.tail !== prevNode || (prevNode !== undefined && prevNode.next !== undefined)) errors.push(`${name} ${price}: tail inconsistent`);
        if (sum !== level.totalQuantity) errors.push(`${name} ${price}: totalQuantity ${level.totalQuantity} != ${sum}`);
      }
    }
    if (linked !== this.orders.size) errors.push(`index size ${this.orders.size} != linked nodes ${linked}`);
    const bid = this.bestBid();
    const ask = this.bestAsk();
    if (bid !== undefined && ask !== undefined && bid >= ask) errors.push(`book crossed: bid ${bid} >= ask ${ask}`);
    return errors;
  }

  private createSide(side: Side): SideBook {
    return { levels: new Map<bigint, PriceLevel>(), prices: new SortedPrices(side) };
  }

  private sideBook(side: Side): SideBook {
    return side === "BUY" ? this.bids : this.asks;
  }

  private levelViews(sideBook: SideBook, prices: readonly bigint[]): LevelView[] {
    return prices.map((price) => {
      const level = sideBook.levels.get(price);
      if (level === undefined) {
        throw new Error(`Missing level for price ${price.toString()}`);
      }
      return {
        price,
        totalQuantity: level.totalQuantity,
        orders: Array.from(level, (node) => ({
          orderId: node.orderId,
          accountId: node.accountId,
          remaining: node.remaining,
          arrivalSeq: node.arrivalSeq,
        })),
      };
    });
  }
}
