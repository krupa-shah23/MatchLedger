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
export declare function analyzeEvents(steps: readonly CommandEvents[], finalRestingOrders: readonly RestingOrder[]): EventAnalysis;
export type { PlaceOrder };
