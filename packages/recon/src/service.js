export function previewAdjustment(breakDef, side) {
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
export async function resolveBreak(input) {
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
export async function runReconciliation(input) {
    const results = [];
    for (const breakDef of input.breaks) {
        const preview = previewAdjustment(breakDef, "BUYER");
        const workflow = { breakId: breakDef.tradeId, status: "OPEN" };
        const adjustment = preview === undefined ? undefined : {
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
