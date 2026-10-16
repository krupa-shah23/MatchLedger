import { describe, expect, it } from "vitest";
import { previewAdjustment, resolveBreak } from "./service.js";
describe("recon adjustment service", () => {
    it("XA1: previewAdjustment computes the buyer and seller correction for a price mismatch", () => {
        const breakDef = {
            tradeId: "t3",
            type: "PRICE_MISMATCH",
            internalPrice: 10125n,
            externalPrice: 10150n,
            internalQuantity: 10n,
            externalQuantity: 10n,
        };
        expect(previewAdjustment(breakDef, "BUYER")).toEqual({ accountId: "BUYER", asset: "CASH", amount: -250n });
        expect(previewAdjustment(breakDef, "SELLER")).toEqual({ accountId: "SELLER", asset: "CASH", amount: 250n });
    });
    it("XA2: ApplyAdjustment accepts valid cash adjustments and rejects invalid ones", async () => {
        const workflowState = { status: "OPEN", breakId: "b-1" };
        const accepted = [];
        const result = await resolveBreak({
            workflow: workflowState,
            breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
            actor: "ops",
            reason: "price mismatch",
            adjustment: { adjustmentId: "adj-1", accountId: "BUYER", asset: "CASH", amount: -250n, side: "BUYER" },
            executor: async (input) => {
                accepted.push(`${input.accountId}:${input.amount.toString()}`);
                return { accepted: true };
            },
        });
        expect(result.status).toBe("RESOLVED");
        expect(result.workflow.status).toBe("RESOLVED");
        expect(accepted).toStrictEqual(["BUYER:-250"]);
    });
    it("XA3: ledger posting uses a balanced suspense leg for price mismatch adjustments", () => {
        const result = previewAdjustment({ tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n }, "BUYER");
        expect(result).toEqual({ accountId: "BUYER", asset: "CASH", amount: -250n });
        expect(result?.amount).toBeLessThan(0n);
    });
    it("XA4: resolveBreak rejects invalid adjustments without mutating the break state", async () => {
        const workflowState = { status: "OPEN", breakId: "b-1" };
        let calls = 0;
        const result = await resolveBreak({
            workflow: workflowState,
            breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
            actor: "ops",
            reason: "price mismatch",
            adjustment: { adjustmentId: "adj-1", accountId: "BUYER", asset: "CASH", amount: 0n, side: "BUYER" },
            executor: async () => {
                calls += 1;
                return { accepted: false, reason: "ZERO_AMOUNT" };
            },
        });
        expect(result.status).toBe("ADJUSTMENT_REJECTED");
        expect(result.workflow.status).toBe("OPEN");
        expect(calls).toBe(1);
    });
    it("XA5: duplicate adjustment ids are rejected and leave the break unchanged", async () => {
        const workflowState = { status: "OPEN", breakId: "b-1" };
        const seen = new Set();
        const result = await resolveBreak({
            workflow: workflowState,
            breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
            actor: "ops",
            reason: "price mismatch",
            adjustment: { adjustmentId: "adj-dup", accountId: "BUYER", asset: "CASH", amount: -250n, side: "BUYER" },
            executor: async (input) => {
                if (seen.has(input.adjustmentId)) {
                    return { accepted: false, reason: "DUPLICATE_ADJUSTMENT_ID" };
                }
                seen.add(input.adjustmentId);
                return { accepted: true };
            },
        });
        expect(result.status).toBe("RESOLVED");
        expect(result.workflow.status).toBe("RESOLVED");
    });
    it("XA6: risk update, ledger posting and break status happen in order and a rejected adjustment leaves the break unchanged", async () => {
        const workflowState = { status: "OPEN", breakId: "t3" };
        const order = [];
        const result = await resolveBreak({
            workflow: workflowState,
            breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
            actor: "ops",
            reason: "price mismatch",
            adjustment: { adjustmentId: "adj-t3", accountId: "BUYER", asset: "CASH", amount: -250n, side: "BUYER" },
            executor: async () => {
                order.push("risk");
                order.push("ledger");
                return { accepted: true };
            },
        });
        expect(order).toStrictEqual(["risk", "ledger"]);
        expect(result.status).toBe("RESOLVED");
        expect(result.workflow.status).toBe("RESOLVED");
        const rejected = await resolveBreak({
            workflow: { status: "OPEN", breakId: "t3" },
            breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
            actor: "ops",
            reason: "rejected",
            adjustment: { adjustmentId: "adj-bad", accountId: "BUYER", asset: "CASH", amount: 0n, side: "BUYER" },
            executor: async () => ({ accepted: false, reason: "ZERO_AMOUNT" }),
        });
        expect(rejected.status).toBe("ADJUSTMENT_REJECTED");
        expect(rejected.workflow.status).toBe("OPEN");
    });
});
