import type { SqlExecutor } from "@matchledger/journal";
export interface ReconRun {
    runId: string;
    fileHash: string;
    cutoffTs: number;
    priceDecimals: number;
    countsJson: string;
}
export interface ReconBreak {
    breakId: string;
    runId: string;
    type: string;
    status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "WRITTEN_OFF";
    details: string;
}
export declare class PgReconStore {
    private sql;
    constructor(sql: SqlExecutor);
    startRun(run: ReconRun): Promise<void>;
    addBreak(brk: ReconBreak): Promise<void>;
    transitionBreak(breakId: string, fromStatus: string, toStatus: string, reason: string, actor: string): Promise<void>;
    getBreaks(runId: string, status?: string): Promise<readonly ReconBreak[]>;
}
