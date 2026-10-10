// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
// Intentionally buggy comparison; do not copy this pattern.

import { decide } from "./decide.js";
import type { AsyncAccountStore } from "./account-store.js";
import type { ReserveRequest, ReserveResult, RiskHooks } from "./types.js";

export class NaiveRisk {
  public constructor(private readonly store: AsyncAccountStore, private readonly hooks?: RiskHooks) {}

  public async handle(request: ReserveRequest): Promise<ReserveResult> {
    this.hooks?.onHandlerStart?.(request);
    const acct = await this.store.read(request.accountId);
    const { result, next } = decide(acct, request);
    if (next) await this.store.write(request.accountId, next);
    this.hooks?.onHandlerEnd?.(request);
    return result;
  }
}
