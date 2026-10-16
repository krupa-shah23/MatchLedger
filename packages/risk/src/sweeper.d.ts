import type { RiskStage } from "./stage.js";
export declare class LeakSweeper {
    private readonly opts;
    constructor(opts: {
        readonly stage: RiskStage;
        readonly olderThanMs: number;
    });
    tick(): void;
}
