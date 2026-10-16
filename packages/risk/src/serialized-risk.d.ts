import type { AsyncAccountStore } from "./account-store.js";
import type { ReserveRequest, ReserveResult, RiskHooks } from "./types.js";
export declare class SerializedRisk {
    private readonly store;
    private readonly queue;
    private loopDone;
    constructor(store: AsyncAccountStore, options: {
        readonly queueCapacity: number;
        readonly hooks?: RiskHooks;
    });
    submit(request: ReserveRequest): Promise<ReserveResult>;
    stop(): Promise<void>;
    private loop;
    readonly state: "RUNNING";
    get done(): Promise<void>;
}
