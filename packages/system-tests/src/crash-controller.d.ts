export declare class SimulatedCrash extends Error {
    constructor(message: string);
}
export type CrashKind = "engine.journal.append" | "engine.events.append" | "engine.snapshot.save" | "risk.journal.append" | "risk.events.append" | "risk.snapshot.save" | "ledger.append" | "shard.enqueue" | "stage.notify";
export interface CrashPlan {
    kind: CrashKind;
    nth: number;
    when: "before" | "after";
}
export declare class CrashController {
    private plan;
    private callCounts;
    crashed: boolean;
    arm(plan: CrashPlan): void;
    trip(kind: CrashKind, when: "before" | "after", fn: () => Promise<void>): Promise<void>;
    callCount(kind: CrashKind): number;
}
