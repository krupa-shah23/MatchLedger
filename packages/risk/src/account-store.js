// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
import { UnknownAccountError } from "./errors.js";
export class AsyncAccountStore {
    delay;
    accounts;
    failure;
    readCount = 0;
    writeCount = 0;
    constructor(initial, delay) {
        this.delay = delay;
        this.accounts = new Map();
        for (const [accountId, state] of initial)
            this.accounts.set(accountId, { ...state });
    }
    async read(accountId) {
        await this.delay();
        const state = this.accounts.get(accountId);
        if (state === undefined)
            throw new UnknownAccountError(accountId);
        this.readCount += 1;
        return { ...state };
    }
    async write(accountId, state) {
        await this.delay();
        const existing = this.accounts.get(accountId);
        if (existing === undefined)
            throw new UnknownAccountError(accountId);
        this.writeCount += 1;
        const call = this.writeCount;
        if (this.failure?.call === call) {
            const error = this.failure.error;
            this.failure = undefined;
            throw error;
        }
        this.accounts.set(accountId, { ...state });
    }
    peek(accountId) {
        const state = this.accounts.get(accountId);
        if (state === undefined)
            throw new UnknownAccountError(accountId);
        return { ...state };
    }
    failWriteOnCall(call, error) {
        this.failure = { call, error };
    }
}
