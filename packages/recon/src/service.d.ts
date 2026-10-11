import type { BreakDefinition } from "./core/matcher.js";
import type { WorkflowStatus } from "./core/workflow.js";
export type AdjustmentRole = "BUYER" | "SELLER";
export type AdjustmentInput = {
    readonly adjustmentId: string;
    readonly accountId: string;
    readonly asset: string;
    readonly amount: bigint;
    readonly side: AdjustmentRole;
};
export type AdjustmentExecutorResult = {
    readonly accepted: boolean;
    readonly reason?: string;
};
export type AdjustmentExecutor = (input: AdjustmentInput) => Promise<AdjustmentExecutorResult> | AdjustmentExecutorResult;
export type ReconciliationWorkflow = {
    readonly breakId: string;
    status: WorkflowStatus;
};
export type ResolveBreakInput = {
    readonly workflow: ReconciliationWorkflow;
    readonly breakDef: BreakDefinition;
    readonly actor: string;
    readonly reason: string;
    readonly adjustment?: AdjustmentInput;
    readonly executor: AdjustmentExecutor;
    readonly ts?: number;
};
export declare function previewAdjustment(breakDef: BreakDefinition, side: AdjustmentRole): {
    readonly accountId: string;
    readonly asset: "CASH";
    readonly amount: bigint;
} | undefined;
export declare function resolveBreak(input: ResolveBreakInput): Promise<{
    readonly status: "RESOLVED" | "ADJUSTMENT_REJECTED" | "WRITTEN_OFF";
    readonly workflow: ReconciliationWorkflow;
    readonly adjustment?: AdjustmentInput;
    readonly reason?: string;
}>;
export declare function runReconciliation(input: {
    readonly breaks: readonly BreakDefinition[];
    readonly executor: AdjustmentExecutor;
    readonly actor: string;
    readonly reason: string;
}): Promise<readonly {
    readonly breakId: string;
    readonly status: "RESOLVED" | "ADJUSTMENT_REJECTED" | "WRITTEN_OFF";
    readonly adjustment?: AdjustmentInput;
}[]>;
