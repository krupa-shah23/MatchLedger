import fc from "fast-check";
import type { Command, InstrumentConfig, PlaceOrder } from "../../src/matching/types.js";
export declare const instrumentSpecArbitrary: fc.Arbitrary<InstrumentConfig>;
export declare const commandSequenceArbitrary: (config: InstrumentConfig) => fc.Arbitrary<Command[]>;
export declare const validGtcSequenceArbitrary: (config: InstrumentConfig) => fc.Arbitrary<PlaceOrder[]>;
