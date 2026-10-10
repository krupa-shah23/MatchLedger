import type { Command, Event, InstrumentConfig, Side } from "../../src/matching/types.js";

interface Resting {
  orderId: string;
  accountId: string;
  side: Side;
  price: bigint;
  remaining: bigint;
  arrivalSeq: bigint;
}

/** Slow reference: plain array, full scan per incoming order; shares no code with the engine. */
export class ReferenceMatcher {
  private resting: Resting[] = [];
  private seq = 1n;
  private trades = 1n;
  private arrival = 1n;

  public constructor(private readonly config: InstrumentConfig) {}

  public apply(command: Command): Event[] {
    if (command.kind === "TICK") return [];
    if (command.kind === "CANCEL") {
      const index = this.resting.findIndex((o) => o.orderId === command.orderId);
      if (index < 0) return [this.emit({ type: "CANCEL_REJECTED", ts: command.ts, orderId: command.orderId, reason: "ORDER_NOT_RESTING" })];
      const [order] = this.resting.splice(index, 1);
      return [this.emit({ type: "ORDER_CANCELLED", ts: command.ts, orderId: command.orderId, remaining: order!.remaining, reason: "USER_REQUEST" })];
    }
    const c = this.config;
    let reason: string | undefined;
    if (this.resting.some((o) => o.orderId === command.orderId)) reason = "DUPLICATE_ORDER_ID";
    else if (command.quantity <= 0n) reason = "INVALID_QUANTITY";
    else if (command.price <= 0n) reason = "INVALID_PRICE";
    else if (command.price % c.tickSize !== 0n) reason = "INVALID_TICK";
    else if (command.quantity % c.lotSize !== 0n) reason = "INVALID_LOT";
    else if (command.quantity > c.maxQuantity) reason = "EXCEEDS_MAX_QUANTITY";
    else if (command.price > c.maxPrice) reason = "EXCEEDS_MAX_PRICE";
    if (reason !== undefined) {
      return [this.emit({ type: "ORDER_REJECTED", ts: command.ts, orderId: command.orderId, reason } as never)];
    }
    const arrivalSeq = this.arrival++;
    const events: Event[] = [
      this.emit({
        type: "ORDER_ACCEPTED", ts: command.ts, orderId: command.orderId, accountId: command.accountId,
        side: command.side, orderType: command.orderType, price: command.price, quantity: command.quantity,
      } as never),
    ];
    let remaining = command.quantity;
    for (;;) {
      if (remaining === 0n) break;
      const candidates = this.resting
        .filter((o) => o.side !== command.side && (command.side === "BUY" ? o.price <= command.price : o.price >= command.price))
        .sort((a, b) => {
          if (a.price !== b.price) return (command.side === "BUY" ? a.price < b.price : a.price > b.price) ? -1 : 1;
          return a.arrivalSeq < b.arrivalSeq ? -1 : 1;
        });
      const maker = candidates[0];
      if (maker === undefined) break;
      const fill = remaining < maker.remaining ? remaining : maker.remaining;
      events.push(this.emit({
        type: "TRADE_EXECUTED", ts: command.ts, tradeId: `${c.symbol}-T${(this.trades++).toString()}`, symbol: c.symbol,
        price: maker.price, quantity: fill, takerOrderId: command.orderId, makerOrderId: maker.orderId,
        takerAccountId: command.accountId, makerAccountId: maker.accountId, takerSide: command.side,
      } as never));
      remaining -= fill;
      maker.remaining -= fill;
      if (maker.remaining === 0n) this.resting = this.resting.filter((o) => o !== maker);
    }
    if (remaining > 0n && command.timeInForce === "IOC") {
      events.push(this.emit({ type: "ORDER_CANCELLED", ts: command.ts, orderId: command.orderId, remaining, reason: "IOC_REMAINDER" } as never));
    } else if (remaining > 0n) {
      this.resting.push({ orderId: command.orderId, accountId: command.accountId, side: command.side, price: command.price, remaining, arrivalSeq });
      events.push(this.emit({ type: "ORDER_RESTED", ts: command.ts, orderId: command.orderId, side: command.side, price: command.price, remaining } as never));
    }
    return events;
  }

  public restingOrders(): Resting[] {
    return this.resting.map((o) => ({ ...o }));
  }

  private emit(event: Record<string, unknown>): Event {
    const out = { ...event, engineSeq: this.seq };
    this.seq += 1n;
    return out as unknown as Event;
  }
}
