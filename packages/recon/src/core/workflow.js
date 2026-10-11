const legalTransitions = new Map([
    ["OPEN", new Set(["INVESTIGATING", "RESOLVED", "WRITTEN_OFF"])],
    ["INVESTIGATING", new Set(["RESOLVED", "WRITTEN_OFF"])],
    ["RESOLVED", new Set()],
    ["WRITTEN_OFF", new Set()],
]);
export class BreakWorkflow {
    breakId;
    status;
    audit = [];
    createdAt;
    nextSeq = 1;
    constructor(initial) {
        this.breakId = initial.breakId;
        this.status = initial.status;
        this.createdAt = initial.ts;
    }
    transition(input) {
        const trimmedReason = input.reason.trim();
        if (trimmedReason.length === 0) {
            throw new Error("workflow reason cannot be empty");
        }
        if (input.actor.trim().length === 0) {
            throw new Error("workflow actor cannot be empty");
        }
        if (this.status === "RESOLVED" || this.status === "WRITTEN_OFF") {
            throw new Error(`break ${this.breakId} is terminal`);
        }
        const validTargets = legalTransitions.get(this.status) ?? new Set();
        if (!validTargets.has(input.to)) {
            throw new Error(`illegal transition ${this.status} -> ${input.to}`);
        }
        const entry = {
            breakId: this.breakId,
            seq: this.nextSeq,
            from: this.status,
            to: input.to,
            reason: trimmedReason,
            actor: input.actor.trim(),
            ts: input.ts,
            adjustmentId: input.adjustmentId,
        };
        this.audit.push(entry);
        this.nextSeq += 1;
        this.status = input.to;
        return entry;
    }
    ageMs(nowTs) {
        return Math.max(0, nowTs - this.createdAt);
    }
}
