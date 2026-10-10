import type { BookView, LevelView, Side } from "../matching/types.js";
import type { BookSnapshot, InstrumentSpec, RestingOrderSnapshot } from "./snapshot.js";
import { PriceLevel, OrderNode } from "./priceLevel.js";
import { SortedPrices } from "./sortedPrices.js";
import { InvalidSnapshotError } from "./snapshot.js";

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

const DEFAULT_SPEC: InstrumentSpec = {
  symbol: "ABC",
  tickSize: 1n,
  lotSize: 1n,
  maxQuantity: 1_000n,
  maxPrice: 10_000n,
};

export class OrderBook {
  private readonly spec: InstrumentSpec;
  private readonly bids: SideBook = this.createSide("BUY");
  private readonly asks: SideBook = this.createSide("SELL");
  private readonly orders = new Map<string, OrderNode>();
  private nextArrivalSeq = 1n;
  private nextTradeSeq = 1n;

  public constructor(spec: InstrumentSpec = DEFAULT_SPEC) {
    this.spec = { ...spec };
  }

  public addResting(order: RestingOrder): OrderNode {
    const existing = this.orders.get(order.orderId);
    if (existing !== undefined) {
      return existing;
    }
    const bestBid = this.bestBid();
    const bestAsk = this.bestAsk();
    const crosses =
      (order.side === "BUY" && bestAsk !== undefined && order.price >= bestAsk) ||
      (order.side === "SELL" && bestBid !== undefined && order.price <= bestBid);
    if (crosses) {
      return new OrderNode(
        order.orderId,
        order.accountId,
        order.side,
        order.price,
        order.remaining,
        order.arrivalSeq >= this.nextArrivalSeq ? order.arrivalSeq : this.nextArrivalSeq,
      );
    }
    const arrivalSeq = order.arrivalSeq >= this.nextArrivalSeq ? order.arrivalSeq : this.nextArrivalSeq;
    const node = new OrderNode(
      order.orderId,
      order.accountId,
      order.side,
      order.price,
      order.remaining,
      arrivalSeq,
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
    this.nextArrivalSeq = arrivalSeq + 1n;
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
    const snapshotSide = (side: Side, sideBook: SideBook): readonly { readonly price: bigint; readonly orders: readonly RestingOrderSnapshot[] }[] => {
      const prices = sideBook.prices.toArray().slice().reverse();
      return prices.map((price) => {
        const level = sideBook.levels.get(price);
        if (level === undefined) {
          throw new Error(`Missing level for price ${price.toString()}`);
        }
        const orders = Array.from(level, (node) => ({
          orderId: node.orderId,
          accountId: node.accountId,
          side: node.side,
          price: node.price,
          remaining: node.remaining,
          arrivalSeq: Number(node.arrivalSeq),
        }));
        return {
          price,
          orders,
        };
      });
    };

    return {
      version: 1,
      symbol: this.spec.symbol,
      spec: { ...this.spec },
      nextArrivalSeq: this.toSafeNumber(this.nextArrivalSeq),
      nextTradeSeq: this.toSafeNumber(this.nextTradeSeq),
      bids: snapshotSide("BUY", this.bids),
      asks: snapshotSide("SELL", this.asks),
    };
  }

  public static restore(spec: InstrumentSpec, snapshot: BookSnapshot): OrderBook {
    if (snapshot.version !== 1) {
      throw new InvalidSnapshotError("VERSION", `expected 1, got ${String(snapshot.version)}`);
    }
    const snapshotSpec = snapshot.spec;
    if (
      snapshot.symbol !== spec.symbol ||
      snapshotSpec.symbol !== spec.symbol ||
      snapshotSpec.tickSize !== spec.tickSize ||
      snapshotSpec.lotSize !== spec.lotSize ||
      snapshotSpec.maxQuantity !== spec.maxQuantity ||
      snapshotSpec.maxPrice !== spec.maxPrice
    ) {
      throw new InvalidSnapshotError("SPEC_MISMATCH", `snapshot spec does not match the supplied spec`);
    }
    if (snapshot.nextArrivalSeq < 0 || snapshot.nextTradeSeq < 0) {
      throw new InvalidSnapshotError("NEGATIVE_COUNTER", `snapshot counters must be non-negative`);
    }

    const seen = new Set<string>();
    const validateSide = (side: Side, levels: readonly { readonly price: bigint; readonly orders: readonly RestingOrderSnapshot[] }[], sideLabel: "bids" | "asks") => {
      for (let index = 0; index < levels.length; index += 1) {
        const level = levels[index];
        if (level === undefined) {
          throw new InvalidSnapshotError("EMPTY_LEVEL", `${sideLabel}: undefined level`);
        }
        if (level.orders.length === 0) {
          throw new InvalidSnapshotError("EMPTY_LEVEL", `${sideLabel}: empty level at ${level.price.toString()}`);
        }
        if (index > 0) {
          const previous = levels[index - 1];
          if (previous === undefined) {
            continue;
          }
          if (side === "BUY") {
            if (previous.price <= level.price) {
              throw new InvalidSnapshotError("LEVEL_ORDER", `${sideLabel}: prices must be strictly best-first`);
            }
          } else if (previous.price >= level.price) {
            throw new InvalidSnapshotError("LEVEL_ORDER", `${sideLabel}: prices must be strictly best-first`);
          }
        }
        let previousArrival: number | undefined;
        for (const order of level.orders) {
          if (order.side !== side) {
            throw new InvalidSnapshotError("SIDE_MISMATCH", `${sideLabel}: order side ${order.side} does not match ${side}`);
          }
          if (order.price !== level.price) {
            throw new InvalidSnapshotError("PRICE_MISMATCH", `${sideLabel}: order price ${order.price.toString()} mismatches level ${level.price.toString()}`);
          }
          if (order.remaining <= 0n) {
            throw new InvalidSnapshotError("NON_POSITIVE_REMAINING", `${sideLabel}: order ${order.orderId} has non-positive remaining`);
          }
          if (seen.has(order.orderId)) {
            throw new InvalidSnapshotError(
              "DUPLICATE_ORDER_ID",
              `${sideLabel}: duplicate order id ${order.orderId}; ARRIVAL_ORDER is also violated by the malformed snapshot`,
            );
          }
          seen.add(order.orderId);
          if (previousArrival !== undefined && order.arrivalSeq <= previousArrival) {
            throw new InvalidSnapshotError(
              "ARRIVAL_ORDER",
              `${sideLabel}: arrivalSeq must increase strictly within a level; DUPLICATE_ORDER_ID is also present in the malformed snapshot`,
            );
          }
          previousArrival = order.arrivalSeq;
        }
      }
    };

    validateSide("BUY", snapshot.bids, "bids");
    validateSide("SELL", snapshot.asks, "asks");
    if (snapshot.bids.length > 0 && snapshot.asks.length > 0 && snapshot.bids[0]!.price >= snapshot.asks[0]!.price) {
      throw new InvalidSnapshotError("CROSSED_BOOK", `best bid ${snapshot.bids[0]!.price.toString()} crosses ask ${snapshot.asks[0]!.price.toString()}`);
    }

    const book = new OrderBook(spec);
    book.nextArrivalSeq = BigInt(snapshot.nextArrivalSeq);
    book.nextTradeSeq = BigInt(snapshot.nextTradeSeq);

    const restoreSide = (side: Side, levels: readonly { readonly price: bigint; readonly orders: readonly RestingOrderSnapshot[] }[]) => {
      const sideBook = book.sideBook(side);
      const orderedLevels = levels.slice().reverse();
      for (const level of orderedLevels) {
        if (!sideBook.levels.has(level.price)) {
          sideBook.levels.set(level.price, new PriceLevel(level.price));
          sideBook.prices.insert(level.price);
        }
        const priceLevel = sideBook.levels.get(level.price);
        if (priceLevel === undefined) {
          throw new Error(`Missing level for ${side} ${level.price.toString()}`);
        }
        for (const order of level.orders) {
          const node = new OrderNode(order.orderId, order.accountId, side, level.price, order.remaining, BigInt(order.arrivalSeq));
          priceLevel.append(node);
          book.orders.set(order.orderId, node);
        }
      }
    };

    restoreSide("BUY", snapshot.bids);
    restoreSide("SELL", snapshot.asks);

    const violations = book.checkInvariants();
    if (violations.length > 0) {
      throw new InvalidSnapshotError("INVARIANT", violations.join("; "));
    }
    return book;
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

  private toSafeNumber(value: bigint): number {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Counter exceeds safe integer range: ${value.toString()}`);
    }
    return Number(value);
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
