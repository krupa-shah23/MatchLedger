// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.

import type { AsyncAccountStore } from "./account-store.js";
import type { ReserveRequest, ReserveResult, RiskHooks } from "./types.js";

export class SerializedRisk {
  public constructor(store: AsyncAccountStore, options: { readonly queueCapacity: number; readonly hooks?: RiskHooks }) {
    void store;
    void options;
  }

  public submit(request: ReserveRequest): Promise<ReserveResult> {
    // Hand-written implementation must enqueue a request and resolve it only
    // after the single loop has completed its read/decide/write sequence.
    void request;
    throw new Error("SerializedRisk: hand-written");
  }

  public stop(): Promise<void> {
    // Hand-written implementation must close the queue and await loop completion.
    throw new Error("SerializedRisk: hand-written");
  }

  public readonly state = "RUNNING" as const;
  public readonly done = Promise.resolve();
}
