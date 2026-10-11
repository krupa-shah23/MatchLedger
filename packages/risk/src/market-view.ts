import type { MarketInput, ShardOutput } from "@matchledger/common";

type Side = "BUY" | "SELL";

type RestingOrder = {
  readonly side: Side;
  readonly price: bigint;
  remaining: bigint;
};

type SymbolBook = {
  readonly resting: Map<string, RestingOrder>;
  readonly bids: Map<bigint, bigint>;
  readonly asks: Map<bigint, bigint>;
};

export class MarketView {
  private readonly books = new Map<string, SymbolBook>();
  private readonly lastTrade = new Map<string, { readonly price: bigint; readonly ts: number }>();

  public apply(symbol: string, event: ShardOutput["events"][number], ts: number): void {
    const book = this.ensureBook(symbol);

    switch (event.type) {
      case "ORDER_RESTED": {
        const existing = book.resting.get(event.orderId);
        if (existing !== undefined) {
          this.adjustLevel(book, existing.side, existing.price, -existing.remaining);
        }
        const order: RestingOrder = { side: event.side, price: event.price, remaining: event.remaining };
        book.resting.set(event.orderId, order);
        this.adjustLevel(book, event.side, event.price, event.remaining);
        break;
      }
      case "TRADE_EXECUTED": {
        this.lastTrade.set(symbol, { price: event.price, ts });
        const makerSide = event.takerSide === "BUY" ? "SELL" : "BUY";
        const makerOrder = book.resting.get(event.makerOrderId);
        if (makerOrder !== undefined && makerOrder.side === makerSide) {
          const nextRemaining = makerOrder.remaining - event.quantity;
          this.adjustLevel(book, makerOrder.side, makerOrder.price, -event.quantity);
          if (nextRemaining <= 0n) {
            book.resting.delete(event.makerOrderId);
          } else {
            makerOrder.remaining = nextRemaining;
          }
        }
        break;
      }
      case "ORDER_CANCELLED": {
        const order = book.resting.get(event.orderId);
        if (order !== undefined) {
          this.adjustLevel(book, order.side, order.price, -order.remaining);
          book.resting.delete(event.orderId);
        }
        break;
      }
      default:
        break;
    }
  }

  public snapshotFor(symbol: string): MarketInput {
    const book = this.books.get(symbol);
    const lastTrade = this.lastTrade.get(symbol);
    const bid = this.bestLevel(book?.bids);
    const ask = this.bestLevel(book?.asks, true);

    return {
      ...(lastTrade !== undefined ? { lastTradePrice: lastTrade.price, lastTradeTs: lastTrade.ts } : {}),
      ...(bid !== undefined ? { bestBid: bid } : {}),
      ...(ask !== undefined ? { bestAsk: ask } : {}),
    };
  }

  private ensureBook(symbol: string): SymbolBook {
    const existing = this.books.get(symbol);
    if (existing !== undefined) {
      return existing;
    }

    const next: SymbolBook = {
      resting: new Map<string, RestingOrder>(),
      bids: new Map<bigint, bigint>(),
      asks: new Map<bigint, bigint>(),
    };
    this.books.set(symbol, next);
    return next;
  }

  private adjustLevel(book: SymbolBook, side: Side, price: bigint, delta: bigint): void {
    const levels = side === "BUY" ? book.bids : book.asks;
    const current = levels.get(price) ?? 0n;
    const next = current + delta;
    if (next <= 0n) {
      levels.delete(price);
      return;
    }
    levels.set(price, next);
  }

  private bestLevel(levels: Map<bigint, bigint> | undefined, lowest = false): bigint | undefined {
    if (levels === undefined || levels.size === 0) {
      return undefined;
    }

    let best: bigint | undefined;
    for (const [price, quantity] of levels.entries()) {
      if (quantity <= 0n) {
        continue;
      }
      if (best === undefined) {
        best = price;
        continue;
      }
      if (lowest ? price < best : price > best) {
        best = price;
      }
    }
    return best;
  }
}
