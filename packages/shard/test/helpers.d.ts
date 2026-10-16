import type { Clock } from "@matchledger/common";
import type { Command, InstrumentConfig, Side } from "@matchledger/engine-core";
export declare class FakeClock implements Clock {
    readonly readings: number[];
    private index;
    constructor(readings: number[]);
    now(): number;
    set(value: number): void;
}
export declare const ACME: InstrumentConfig;
export declare const BETA: InstrumentConfig;
export declare function place(orderId: string, side?: Side, price?: bigint, quantity?: bigint): Command;
export declare function cancel(orderId: string): Command;
export declare function settle(runner: {
    stop(options?: {
        drain?: boolean;
    }): Promise<void>;
    done: Promise<unknown>;
}): Promise<void>;
