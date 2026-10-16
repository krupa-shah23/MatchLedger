import { describe, it, expect } from "vitest";
import { txIdForDeposit, txIdForTrade, txIdForAdjustment, txIdForReversal } from "./tx-id.js";

describe("tx-id functions", () => {
  it("produces identical deposit ids", () => {
    const requestId = "req123";
    expect(txIdForDeposit(requestId)).toBe(`dep:${requestId}`);
  });

  it("produces identical trade ids", () => {
    const tradeId = "t456";
    expect(txIdForTrade(tradeId)).toBe(`trade:${tradeId}`);
  });

  it("produces identical adjustment ids", () => {
    const adjustmentId = "adj789";
    expect(txIdForAdjustment(adjustmentId)).toBe(`adj:${adjustmentId}`);
  });

  it("produces identical reversal ids", () => {
    const originalTxId = "dep:req123";
    expect(txIdForReversal(originalTxId)).toBe(`rev:${originalTxId}`);
  });
});
