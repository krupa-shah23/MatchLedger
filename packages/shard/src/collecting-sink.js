export class CollectingSink {
    delaySchedule;
    batches = [];
    publishCalls = 0;
    held = false;
    pending = [];
    failureCall;
    constructor(delaySchedule = []) {
        this.delaySchedule = delaySchedule;
    }
    publish(batch) {
        this.publishCalls += 1;
        const call = this.publishCalls;
        return this.withDelay(call, () => new Promise((resolve, reject) => {
            if (this.failureCall?.call === call) {
                const error = this.failureCall.error;
                this.failureCall = undefined;
                reject(error);
                return;
            }
            const complete = () => {
                this.batches.push(Array.from(batch));
                resolve();
            };
            if (this.held)
                this.pending.push({ resolve: complete, reject });
            else
                complete();
        }));
    }
    all() {
        return this.batches.flatMap((batch) => batch);
    }
    hold() {
        this.held = true;
    }
    release() {
        this.held = false;
        const pending = this.pending;
        this.pending = [];
        for (const item of pending)
            item.resolve();
    }
    failOnCall(call, error) {
        this.failureCall = { call, error };
    }
    failNext(error) {
        this.failOnCall(this.publishCalls + 1, error);
    }
    async withDelay(call, operation) {
        for (let remaining = this.delaySchedule[call - 1] ?? 0; remaining > 0; remaining -= 1) {
            await Promise.resolve();
        }
        return operation();
    }
}
