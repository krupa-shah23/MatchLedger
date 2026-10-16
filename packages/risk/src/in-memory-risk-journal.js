export class InMemoryRiskJournal {
    batches = [];
    holdCount = 0;
    failNextError;
    failOnCalls = new Map();
    schedule;
    scheduleIndex = 0;
    constructor(opts) {
        this.schedule = opts?.delaySchedule ?? [];
    }
    hold() {
        this.holdCount += 1;
    }
    release() {
        this.holdCount = Math.max(0, this.holdCount - 1);
    }
    failNext(error) {
        this.failNextError = error;
    }
    failOnCall(n, error) {
        this.failOnCalls.set(n, error);
    }
    all() {
        return this.batches.flatMap((batch) => batch);
    }
    async append(batch) {
        while (this.holdCount > 0) {
            await Promise.resolve();
        }
        const callNumber = this.batches.length + 1;
        if (this.failNextError !== undefined) {
            const error = this.failNextError;
            this.failNextError = undefined;
            throw error;
        }
        if (this.failOnCalls.has(callNumber)) {
            throw this.failOnCalls.get(callNumber);
        }
        for (const delay of this.schedule) {
            if (delay > 0) {
                for (let index = 0; index < delay; index += 1) {
                    await Promise.resolve();
                }
            }
            else {
                await Promise.resolve();
            }
        }
        if (this.schedule.length > 0) {
            this.scheduleIndex = (this.scheduleIndex + 1) % this.schedule.length;
        }
        this.batches.push([...batch]);
    }
}
