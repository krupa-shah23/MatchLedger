export class SimulatedCrash extends Error {
    constructor(message) {
        super(message);
        this.name = "SimulatedCrash";
    }
}
export class CrashController {
    plan = null;
    callCounts = new Map();
    crashed = false;
    arm(plan) {
        this.plan = plan;
        this.callCounts.clear();
        this.crashed = false;
    }
    async trip(kind, when, fn) {
        const count = (this.callCounts.get(kind) ?? 0) + 1;
        this.callCounts.set(kind, count);
        if (this.crashed) {
            throw new SimulatedCrash(`Already crashed; no more calls allowed`);
        }
        if (this.plan && this.plan.kind === kind && this.plan.nth === count && this.plan.when === when) {
            this.crashed = true;
            throw new SimulatedCrash(`Crash at ${kind} #${count} (${when})`);
        }
        if (!this.crashed) {
            await fn();
        }
        else {
            throw new SimulatedCrash(`Already crashed; call to ${kind} rejected`);
        }
    }
    callCount(kind) {
        return this.callCounts.get(kind) ?? 0;
    }
}
