import type { ReserveRequest, ReserveResult, AccountState } from "./types.js";
export declare function decide(state: AccountState, request: ReserveRequest): {
    readonly result: ReserveResult;
    readonly next: AccountState | undefined;
};
