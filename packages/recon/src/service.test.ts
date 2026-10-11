import { describe, expect, it } from "vitest";

import { previewAdjustment, resolveBreak } from "./service.js";

describe("recon adjustment service", () => {
  it("RA1: previewAdjustment computes the buyer and seller correction for a price mismatch", () => {
    const breakDef = {
      tradeId: "t3",
      type: "PRICE_MISMATCH",
      internalPrice: 10125n,
      externalPrice: 10150n,
      internalQuantity: 10n,
      externalQuantity: 10n,
    } as const;

    expect(previewAdjustment(breakDef, "BUYER")).toEqual({ accountId: "BUYER", asset: "CASH", amount: -250n });
    expect(previewAdjustment(breakDef, "SELLER")).toEqual({ accountId: "SELLER", asset: "CASH", amount: 250n });
  });

  it("RA2: resolveBreak rejects invalid adjustments without mutating the break state", async () => {
    const workflowState = { status: "OPEN" as const, breakId: "b-1" };
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
});
