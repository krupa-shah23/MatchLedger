import type { BreakDefinition } from "./matcher.js";

export type StoredRun = {
  readonly runId: string;
  readonly fileHash: string;
  readonly breaks: readonly BreakDefinition[];
  readonly rows: number;
  readonly errors: readonly { readonly rowNumber: number; readonly reason: string }[];
  readonly createdAt: number;
};

export class InMemoryReconciliationStore {
  private readonly runs = new Map<string, StoredRun>();

  public addRun(run: StoredRun): StoredRun {
    this.runs.set(run.runId, run);
    return run;
  }

  public getByHash(fileHash: string): StoredRun | undefined {
    for (const run of this.runs.values()) {
      if (run.fileHash === fileHash) {
        return run;
      }
    }
    return undefined;
  }

  public get(runId: string): StoredRun | undefined {
    return this.runs.get(runId);
  }

  public list(): readonly StoredRun[] {
    return [...this.runs.values()];
  }
}
