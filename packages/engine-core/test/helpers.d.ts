import { Engine } from "../src/matching/engine.js";
import type { InstrumentConfig, PlaceOrder, TimeInForce } from "../src/matching/types.js";
export declare const config: InstrumentConfig;
export declare const place: (orderId: string, side: "BUY" | "SELL", price: bigint, quantity: bigint, timeInForce?: TimeInForce, accountId?: string, ts?: bigint) => PlaceOrder;
export declare const cancel: (orderId: string, ts?: bigint) => {
    kind: "CANCEL";
    ts: bigint;
    orderId: string;
};
export declare const expectInvariants: (engine: Engine) => void;
export declare const expectStub: (engine: Engine, command: PlaceOrder) => void;
