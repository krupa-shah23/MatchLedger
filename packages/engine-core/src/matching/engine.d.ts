import type { BookView, Command, Event, InstrumentConfig, LevelView, Side } from "./types.js";
import { type RestingOrder } from "../book/orderBook.js";
export declare class Engine {
    private readonly config;
    private readonly book;
    private engineSeq;
    private tradeCounter;
    private arrivalSeq;
    constructor(config: InstrumentConfig);
    apply(command: Command): Event[];
    checkInvariants(): string[];
    depth(side: Side, n: number): LevelView[];
    restingOrders(): RestingOrder[];
    snapshotView(): BookView;
    private applyTick;
    private applyPlace;
    private applyCancel;
    private rejectionReason;
    private event;
    private opposite;
    private crosses;
}
