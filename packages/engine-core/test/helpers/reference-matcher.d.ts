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
export declare class ReferenceMatcher {
    private readonly config;
    private resting;
    private seq;
    private trades;
    private arrival;
    constructor(config: InstrumentConfig);
    apply(command: Command): Event[];
    restingOrders(): Resting[];
    private emit;
}
export {};
