// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
// Intentionally buggy comparison; do not copy this pattern.
import { decide } from "./decide.js";
export class NaiveRisk {
    store;
    hooks;
    constructor(store, hooks) {
        this.store = store;
        this.hooks = hooks;
    }
    async handle(request) {
        this.hooks?.onHandlerStart?.(request);
        const acct = await this.store.read(request.accountId);
        const { result, next } = decide(acct, request);
        if (next)
            await this.store.write(request.accountId, next);
        this.hooks?.onHandlerEnd?.(request);
        return result;
    }
}
