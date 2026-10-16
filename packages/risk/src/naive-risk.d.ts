import type { AsyncAccountStore } from "./account-store.js";
import type { ReserveRequest, ReserveResult, RiskHooks } from "./types.js";
export declare class NaiveRisk {
    private readonly store;
    private readonly hooks?;
    constructor(store: AsyncAccountStore, hooks?: RiskHooks | undefined);
    handle(request: ReserveRequest): Promise<ReserveResult>;
}
