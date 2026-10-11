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
export declare class BreakWorkflow {
    readonly breakId: string;
    status: WorkflowStatus;
    readonly audit: AuditEntry[];
    private readonly createdAt;
    private nextSeq;
    constructor(initial: {
        readonly breakId: string;
        readonly status: WorkflowStatus;
        readonly actor: string;
        readonly reason: string;
        readonly ts: number;
    });
    transition(input: WorkflowTransition): AuditEntry;
    ageMs(nowTs: number): number;
}
