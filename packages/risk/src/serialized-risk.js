// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
import { BoundedQueue } from "@matchledger/common";
import { decide } from "./decide.js";
export class SerializedRisk {
    store;
    queue;
    loopDone;
    constructor(store, options) {
        this.store = store;
        this.queue = new BoundedQueue(options.queueCapacity);
        this.loopDone = this.loop(options.hooks);
    }
    submit(request) {
        return new Promise((resolve, reject) => {
            const enqueued = this.queue.tryEnqueue({ request, resolve, reject });
            if (!enqueued)
                reject(new Error("SerializedRisk queue full"));
        });
    }
    stop() {
        this.queue.close();
        return this.loopDone;
    }
    async loop(hooks) {
        try {
            for (;;) {
                const msg = await this.queue.dequeue();
                if (msg === undefined)
                    break;
                try {
                    hooks?.onHandlerStart?.(msg.request);
                    const acct = await this.store.read(msg.request.accountId);
                    const { result, next } = decide(acct, msg.request);
                    if (next)
                        await this.store.write(msg.request.accountId, next);
                    hooks?.onHandlerEnd?.(msg.request);
                    msg.resolve(result);
                }
                catch (error) {
                    msg.reject(error);
                    throw error;
                }
            }
        }
        catch (error) {
            this.queue.close();
            for (const msg of this.queue.drainSync(this.queue.size)) {
                msg.reject(error);
            }
        }
    }
    state = "RUNNING";
    get done() { return this.loopDone; }
}
