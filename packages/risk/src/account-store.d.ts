import type { AccountState } from "./types.js";
export declare class AsyncAccountStore {
    private readonly delay;
    private readonly accounts;
    private failure;
    readCount: number;
    writeCount: number;
    constructor(initial: ReadonlyMap<string, AccountState>, delay: () => Promise<void>);
    read(accountId: string): Promise<AccountState>;
    write(accountId: string, state: AccountState): Promise<void>;
    peek(accountId: string): AccountState;
    failWriteOnCall(call: number, error: unknown): void;
}
