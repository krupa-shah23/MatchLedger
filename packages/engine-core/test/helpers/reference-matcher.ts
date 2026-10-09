import type { Command, Event, InstrumentConfig } from "../../src/matching/types.js";

/**
 * Hand-written reference matcher specification:
 * use a plain array of resting orders; independently validate commands; reject
 * duplicate live ids; repeatedly choose the best satisfying opposite order by
 * price then arrival index; trade at the resting price; remove exhausted makers;
 * rest GTC remainders and cancel IOC remainders; cancel resting ids with
 * USER_REQUEST and reject unknown ids. Match engine event shapes and trade ids.
 */
export class ReferenceMatcher {
  public constructor(config: InstrumentConfig) {
    void config;
  }

  public apply(command: Command): Event[] {
    void command;
    throw new Error("reference matcher: hand-written");
  }

  public restingOrders(): readonly never[] {
    throw new Error("reference matcher: hand-written");
  }
}
