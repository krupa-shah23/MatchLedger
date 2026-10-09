// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
// Intentionally buggy comparison; do not copy this pattern.

import type { AsyncAccountStore } from "./account-store.js";
import type { ReserveRequest, ReserveResult, RiskHooks } from "./types.js";

export class NaiveRisk {
  public constructor(store: AsyncAccountStore, hooks?: RiskHooks) {
    void store;
    void hooks;
  }

  public handle(request: ReserveRequest): Promise<ReserveResult> {
    // Hand-written implementation must read, decide, write, and invoke both
    // hooks around one request, without adding a serializing loop.
    void request;
    throw new Error("NaiveRisk.handle: hand-written");
  }
}
