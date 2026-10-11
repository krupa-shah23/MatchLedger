export type WorkflowStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "WRITTEN_OFF";

export type WorkflowTransition = {
  readonly to: WorkflowStatus;
  readonly reason: string;
  readonly actor: string;
  readonly ts: number;
  readonly adjustmentId?: string;
};

export type AuditEntry = {
  readonly breakId: string;
  readonly seq: number;
  readonly from: WorkflowStatus;
  readonly to: WorkflowStatus;
  readonly reason: string;
  readonly actor: string;
  readonly ts: number;
  readonly adjustmentId?: string;
};

const legalTransitions: ReadonlyMap<WorkflowStatus, ReadonlySet<WorkflowStatus>> = new Map([
  ["OPEN", new Set(["INVESTIGATING", "RESOLVED", "WRITTEN_OFF"])],
  ["INVESTIGATING", new Set(["RESOLVED", "WRITTEN_OFF"])],
  ["RESOLVED", new Set()],
  ["WRITTEN_OFF", new Set()],
]);

export class BreakWorkflow {
  public readonly breakId: string;
  public status: WorkflowStatus;
  public readonly audit: AuditEntry[] = [];
  private readonly createdAt: number;
  private nextSeq = 1;

  public constructor(initial: { readonly breakId: string; readonly status: WorkflowStatus; readonly actor: string; readonly reason: string; readonly ts: number }) {
    this.breakId = initial.breakId;
    this.status = initial.status;
    this.createdAt = initial.ts;
  }

  public transition(input: WorkflowTransition): AuditEntry {
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
    const entry: AuditEntry = {
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

  public ageMs(nowTs: number): number {
    return Math.max(0, nowTs - this.createdAt);
  }
}
