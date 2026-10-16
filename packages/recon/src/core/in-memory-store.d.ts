import type { BreakDefinition } from "./matcher.js";
export type StoredRun = {
    readonly runId: string;
    readonly fileHash: string;
    readonly breaks: readonly BreakDefinition[];
    readonly rows: number;
    readonly errors: readonly {
        readonly rowNumber: number;
        readonly reason: string;
    }[];
    readonly createdAt: number;
};
export declare class InMemoryReconciliationStore {
    private readonly runs;
    addRun(run: StoredRun): StoredRun;
    getByHash(fileHash: string): StoredRun | undefined;
    get(runId: string): StoredRun | undefined;
    list(): readonly StoredRun[];
}
