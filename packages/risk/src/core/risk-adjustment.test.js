import { describe, expect, it } from "vitest";
import { RiskCore } from "./risk-core.js";
describe("risk adjustment core", () => {
    it("RA1: ApplyAdjustment accepts valid cash adjustments and rejects invalid ones", () => {
        const core = new RiskCore({ instruments: new Map() });
        const open = { partition: 0, seq: 1, ts: 1, command: { type: "OpenAccount", accountId: "A" } };
        const deposit = { partition: 0, seq: 2, ts: 2, command: { type: "Deposit", accountId: "A", asset: "CASH", amount: 1000n, requestId: "d1" } };
        const valid = { partition: 0, seq: 3, ts: 3, command: { type: "ApplyAdjustment", adjustmentId: "adj-1", accountId: "A", asset: "CASH", amount: 250n } };
        const invalid = { partition: 0, seq: 4, ts: 4, command: { type: "ApplyAdjustment", adjustmentId: "adj-2", accountId: "A", asset: "CASH", amount: 0n } };
        expect(core.apply(open).at(0)?.type).toBe("AccountOpened");
        expect(core.apply(deposit).at(0)?.type).toBe("FundsDeposited");
        const accepted = core.apply(valid);
        expect(accepted).toContainEqual({ type: "AccountAdjusted", accountId: "A", asset: "CASH", amount: 250n, adjustmentId: "adj-1" });
        expect(core.accounts.get("A")?.cash).toBe(1250n);
        const rejected = core.apply(invalid);
        expect(rejected).toContainEqual({ type: "AdjustmentRejected", accountId: "A", asset: "CASH", amount: 0n, adjustmentId: "adj-2", reason: "ZERO_AMOUNT" });
    });
});
