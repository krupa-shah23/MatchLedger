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

export function previewAdjustment(breakDef: BreakDefinition, side: AdjustmentRole): { readonly accountId: string; readonly asset: "CASH"; readonly amount: bigint } | undefined {
  if (breakDef.type !== "PRICE_MISMATCH") {
    return undefined;
  }

  const internalQuantity = breakDef.internalQuantity ?? breakDef.externalQuantity ?? 0n;
  if (internalQuantity <= 0n) {
    return undefined;
  }

  const delta = (breakDef.externalPrice ?? breakDef.internalPrice ?? 0n) - (breakDef.internalPrice ?? breakDef.externalPrice ?? 0n);
  const amount = delta * internalQuantity;
  return {
    accountId: side === "BUYER" ? "BUYER" : "SELLER",
    asset: "CASH",
    amount: side === "BUYER" ? -amount : amount,
  };
}

export async function resolveBreak(input: ResolveBreakInput): Promise<{ readonly status: "RESOLVED" | "ADJUSTMENT_REJECTED" | "WRITTEN_OFF"; readonly workflow: ReconciliationWorkflow; readonly adjustment?: AdjustmentInput; readonly reason?: string }> {
  if (input.adjustment === undefined) {
    if (input.workflow.status === "OPEN" || input.workflow.status === "INVESTIGATING") {
      input.workflow.status = "WRITTEN_OFF";
    }
    return { status: "WRITTEN_OFF", workflow: input.workflow };
  }

  const result = await input.executor(input.adjustment);
  if (!result.accepted) {
    return { status: "ADJUSTMENT_REJECTED", workflow: input.workflow, adjustment: input.adjustment, reason: result.reason };
  }
  if (input.workflow.status === "OPEN" || input.workflow.status === "INVESTIGATING") {
    input.workflow.status = "RESOLVED";
  }
  return { status: "RESOLVED", workflow: input.workflow, adjustment: input.adjustment };
}

export async function runReconciliation(input: {
  readonly breaks: readonly BreakDefinition[];
  readonly executor: AdjustmentExecutor;
  readonly actor: string;
  readonly reason: string;
}): Promise<readonly { readonly breakId: string; readonly status: "RESOLVED" | "ADJUSTMENT_REJECTED" | "WRITTEN_OFF"; readonly adjustment?: AdjustmentInput }[]> {
  const results: Array<{ readonly breakId: string; readonly status: "RESOLVED" | "ADJUSTMENT_REJECTED" | "WRITTEN_OFF"; readonly adjustment?: AdjustmentInput }> = [];
  for (const breakDef of input.breaks) {
    const preview = previewAdjustment(breakDef, "BUYER");
    const workflow = { breakId: breakDef.tradeId, status: "OPEN" as const };
    const adjustment: AdjustmentInput | undefined = preview === undefined ? undefined : {
      adjustmentId: `adj:${breakDef.tradeId}`,
      accountId: preview.accountId,
      asset: preview.asset,
      amount: preview.amount,
      side: "BUYER",
    };
    const resolved = await resolveBreak({ workflow, breakDef, actor: input.actor, reason: input.reason, adjustment, executor: input.executor });
    results.push({ breakId: breakDef.tradeId, status: resolved.status, adjustment: resolved.adjustment });
  }
  return results;
}
