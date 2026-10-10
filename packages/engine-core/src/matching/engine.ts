import type {
  BookView,
  CancelOrder,
  Command,
  CancelRejectReason,
  CancelReason,
  Event,
  InstrumentConfig,
  LevelView,
  PlaceOrder,
  Side,
} from "./types.js";
import { OrderBook, type RestingOrder } from "../book/orderBook.js";

export class Engine {
  private readonly config: InstrumentConfig;
  private readonly book = new OrderBook();
  private engineSeq = 1n;
  private tradeCounter = 1n;
  private arrivalSeq = 1n;

  public constructor(config: InstrumentConfig) {
    if (
      config.tickSize <= 0n ||
      config.lotSize <= 0n ||
      config.maxQuantity <= 0n ||
      config.maxPrice <= 0n
    ) {
      throw new RangeError("Instrument configuration values must be positive");
    }
    this.config = config;
  }

  public apply(command: Command): Event[] {
    if (command.kind === "TICK") {
      return this.applyTick();
    }
    if (command.kind === "CANCEL") {
      return this.applyCancel(command);
    }
    return this.applyPlace(command);
  }

  public checkInvariants(): string[] {
    return this.book.checkInvariants();
  }

  public depth(side: Side, n: number): LevelView[] {
    return this.book.depth(side, n);
  }

  public restingOrders(): RestingOrder[] {
    return this.book.restingOrders();
  }

  public snapshotView(): BookView {
    return this.book.view();
  }

  private applyTick(): Event[] {
    return [];
  }

  private applyPlace(command: PlaceOrder): Event[] {
    const rejection = this.rejectionReason(command);
    if (rejection !== undefined) {
      return [
        this.event({
          type: "ORDER_REJECTED",
          ts: command.ts,
          orderId: command.orderId,
          reason: rejection,
        }),
      ];
    }

    const orderArrivalSeq = this.arrivalSeq;
    this.arrivalSeq += 1n;
    const events: Event[] = [
      this.event({
        type: "ORDER_ACCEPTED",
        ts: command.ts,
        orderId: command.orderId,
        accountId: command.accountId,
        side: command.side,
        orderType: command.orderType,
        price: command.price,
        quantity: command.quantity,
      }),
    ];
    let remaining = command.quantity;
    while (remaining > 0n) {
      const makerLevel = this.book.bestLevel(this.opposite(command.side));
      if (makerLevel === undefined || !this.crosses(command.side, command.price, makerLevel.price)) {
        break;
      }
      const maker = makerLevel.head;
      if (maker === undefined) {
        throw new Error("Best level is empty");
      }
      const fill = remaining < maker.remaining ? remaining : maker.remaining;
      events.push(
        this.event({
          type: "TRADE_EXECUTED",
          ts: command.ts,
          tradeId: `${this.config.symbol}-T${this.tradeCounter.toString()}`,
          symbol: this.config.symbol,
          price: maker.price,
          quantity: fill,
          takerOrderId: command.orderId,
          makerOrderId: maker.orderId,
          takerAccountId: command.accountId,
          makerAccountId: maker.accountId,
          takerSide: command.side,
        }),
      );
      this.tradeCounter += 1n;
      remaining -= fill;
      this.book.reduceMaker(maker, fill);
      if (maker.remaining === 0n) {
        this.book.cancel(maker.orderId);
      }
    }
    if (remaining > 0n && command.timeInForce === "IOC") {
      events.push(
        this.event({
          type: "ORDER_CANCELLED",
          ts: command.ts,
          orderId: command.orderId,
          remaining,
          reason: "IOC_REMAINDER",
        }),
      );
    } else if (remaining > 0n) {
      this.book.addResting({
        orderId: command.orderId,
        accountId: command.accountId,
        side: command.side,
        price: command.price,
        remaining,
        arrivalSeq: orderArrivalSeq,
      });
      events.push(
        this.event({
          type: "ORDER_RESTED",
          ts: command.ts,
          orderId: command.orderId,
          side: command.side,
          price: command.price,
          remaining,
        }),
      );
    }
    return events;
  }

  private applyCancel(command: CancelOrder): Event[] {
    const node = this.book.cancel(command.orderId);
    if (node === undefined) {
      return [
        this.event({
          type: "CANCEL_REJECTED",
          ts: command.ts,
          orderId: command.orderId,
          reason: "ORDER_NOT_RESTING",
        }),
      ];
    }
    return [
      this.event({
        type: "ORDER_CANCELLED",
        ts: command.ts,
        orderId: command.orderId,
        remaining: node.remaining,
        reason: "USER_REQUEST",
      }),
    ];
  }

  private rejectionReason(command: PlaceOrder): NonNullable<Extract<Event, { type: "ORDER_REJECTED" }>["reason"]> | undefined {
    if (this.book.has(command.orderId)) {
      return "DUPLICATE_ORDER_ID";
    }
    if (command.quantity <= 0n) {
      return "INVALID_QUANTITY";
    }
    if (command.price <= 0n) {
      return "INVALID_PRICE";
    }
    if (command.price % this.config.tickSize !== 0n) {
      return "INVALID_TICK";
    }
    if (command.quantity % this.config.lotSize !== 0n) {
      return "INVALID_LOT";
    }
    if (command.quantity > this.config.maxQuantity) {
      return "EXCEEDS_MAX_QUANTITY";
    }
    if (command.price > this.config.maxPrice) {
      return "EXCEEDS_MAX_PRICE";
    }
    return undefined;
  }

  private event(input: { readonly type: Event["type"]; readonly ts: bigint; readonly orderId?: string; readonly accountId?: string; readonly side?: Side;   readonly orderType?: PlaceOrder["orderType"]; readonly timeInForce?: PlaceOrder["timeInForce"]; readonly price?: bigint; readonly quantity?: bigint; readonly remaining?: bigint; readonly reason?: Extract<Event, { type: "ORDER_REJECTED" }>["reason"] | CancelReason | CancelRejectReason; readonly tradeId?: string; readonly symbol?: string; readonly takerOrderId?: string; readonly makerOrderId?: string; readonly takerAccountId?: string; readonly makerAccountId?: string; readonly takerSide?: Side }): Event {
    const event = { ...input, engineSeq: this.engineSeq };
    this.engineSeq += 1n;
    return event as Event;
  }

  private opposite(side: Side): Side {
    return side === "BUY" ? "SELL" : "BUY";
  }

  private crosses(side: Side, price: bigint, makerPrice: bigint): boolean {
    return side === "BUY" ? makerPrice <= price : makerPrice >= price;
  }
}
