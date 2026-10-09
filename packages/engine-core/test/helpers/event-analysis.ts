import type { Command, Event, PlaceOrder, Side, TimeInForce } from "../../src/matching/types.js";
import type { RestingOrder } from "../../src/book/orderBook.js";

export interface CommandEvents {
  readonly command: Command;
  readonly events: readonly Event[];
}

export interface InstanceRecord {
  readonly instance: number;
  readonly orderId: string;
  readonly side: Side;
  readonly timeInForce: TimeInForce;
  readonly price: bigint;
  readonly quantity: bigint;
  filled: bigint;
  cancelled: bigint;
  rested: boolean;
  arrivalIndex: number | undefined;
  rejected: boolean;
}

export interface AnalyzedTrade {
  readonly price: bigint;
  readonly quantity: bigint;
  readonly makerInstance: InstanceRecord | undefined;
  readonly takerInstance: InstanceRecord | undefined;
}

export interface EventAnalysis {
  readonly instances: readonly InstanceRecord[];
  readonly tradesByCommand: readonly (readonly AnalyzedTrade[])[];
  readonly finalRestingOrders: readonly RestingOrder[];
}

export function analyzeEvents(steps: readonly CommandEvents[], finalRestingOrders: readonly RestingOrder[]): EventAnalysis {
  const instances: InstanceRecord[] = [];
  const live = new Map<string, InstanceRecord>();
  const tradesByCommand: AnalyzedTrade[][] = steps.map(() => []);
  const byId = (id: string): InstanceRecord | undefined => live.get(id);

  steps.forEach((step, commandIndex) => {
    const command = step.command;
    const place = command.kind === "PLACE" ? command : undefined;
    const accepted = place !== undefined && step.events.some((event) => event.type === "ORDER_ACCEPTED");
    const instance = accepted && place !== undefined
      ? { instance: commandIndex, orderId: place.orderId, side: place.side, timeInForce: place.timeInForce, price: place.price, quantity: place.quantity, filled: 0n, cancelled: 0n, rested: false, arrivalIndex: undefined, rejected: false }
      : undefined;
    if (place !== undefined && !accepted) {
      instances.push({ instance: commandIndex, orderId: place.orderId, side: place.side, timeInForce: place.timeInForce, price: place.price, quantity: place.quantity, filled: 0n, cancelled: 0n, rested: false, arrivalIndex: undefined, rejected: true });
    }
    if (instance !== undefined) {
      instances.push(instance);
      live.set(instance.orderId, instance);
    }
    step.events.forEach((event) => {
      if (event.type === "TRADE_EXECUTED") {
        const taker = event.takerOrderId === place?.orderId ? instance : byId(event.takerOrderId);
        const maker = byId(event.makerOrderId);
        if (taker !== undefined) taker.filled += event.quantity;
        if (maker !== undefined) maker.filled += event.quantity;
        tradesByCommand[commandIndex]?.push({ price: event.price, quantity: event.quantity, makerInstance: maker, takerInstance: taker });
        if (maker !== undefined && maker.filled + maker.cancelled >= maker.quantity) live.delete(maker.orderId);
      } else if (event.type === "ORDER_RESTED" && instance !== undefined) {
        instance.rested = true;
        instance.arrivalIndex = commandIndex;
      } else if (event.type === "ORDER_CANCELLED") {
        const cancelled = event.orderId === place?.orderId ? instance : byId(event.orderId);
        if (cancelled !== undefined) {
          cancelled.cancelled += event.remaining;
          live.delete(cancelled.orderId);
        }
      }
    });
  });

  return { instances, tradesByCommand, finalRestingOrders };
}

export type { PlaceOrder };
