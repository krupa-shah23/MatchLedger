import type { Event } from "@matchledger/engine-core";
export declare function serializeEvent(ev: Event): string;
export declare function deserializeEvent(json: string): Event;
