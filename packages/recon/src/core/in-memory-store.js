export class InMemoryReconciliationStore {
    runs = new Map();
    addRun(run) {
        this.runs.set(run.runId, run);
        return run;
    }
    getByHash(fileHash) {
        for (const run of this.runs.values()) {
            if (run.fileHash === fileHash) {
                return run;
            }
        }
        return undefined;
    }
    get(runId) {
        return this.runs.get(runId);
    }
    list() {
        return [...this.runs.values()];
    }
}
