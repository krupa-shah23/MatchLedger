import { describe, it, expect } from "vitest";
import { Ledger, RestoreError, EXTERNAL, SUSPENSE } from "./ledger.js";

describe("Ledger.restore", () => {
  it("restores from empty entries", () => {
    const ledger = Ledger.restore([]);
    expect(ledger.entries()).toHaveLength(0);
  });

  it("restores single transaction", () => {
    const entries = [
      { txId: "dep:r1", seq: 1, accountId: "acc1", asset: "CASH", amount: 100n, direction: "CREDIT" as const, refEventId: "e1" },
      { txId: "dep:r1", seq: 2, accountId: EXTERNAL, asset: "CASH", amount: -100n, direction: "DEBIT" as const, refEventId: "e1" },
    ];
    const ledger = Ledger.restore(entries);
    expect(ledger.entries()).toHaveLength(2);
    expect(ledger.balance("acc1", "CASH")).toBe(100n);
    expect(ledger.balance(EXTERNAL, "CASH")).toBe(-100n);
  });

  it("restores multiple transactions in order", () => {
    const entries = [
      { txId: "dep:r1", seq: 1, accountId: "acc1", asset: "CASH", amount: 100n, direction: "CREDIT" as const, refEventId: "e1" },
      { txId: "dep:r1", seq: 2, accountId: EXTERNAL, asset: "CASH", amount: -100n, direction: "DEBIT" as const, refEventId: "e1" },
      { txId: "adj:a1", seq: 3, accountId: "acc1", asset: "CASH", amount: -50n, direction: "DEBIT" as const, refEventId: "e2" },
      { txId: "adj:a1", seq: 4, accountId: SUSPENSE, asset: "CASH", amount: 50n, direction: "CREDIT" as const, refEventId: "e2" },
    ];
    const ledger = Ledger.restore(entries);
    expect(ledger.entries()).toHaveLength(4);
    expect(ledger.balance("acc1", "CASH")).toBe(50n);
    expect(ledger.assetTotal("CASH")).toBe(0n);
  });

  it("throws on unbalanced asset in transaction", () => {
    const entries = [
      { txId: "trade:t1", seq: 1, accountId: "acc1", asset: "CASH", amount: -100n, direction: "DEBIT" as const, refEventId: "e1" },
      { txId: "trade:t1", seq: 2, accountId: "acc2", asset: "CASH", amount: 50n, direction: "CREDIT" as const, refEventId: "e1" },
    ];
    expect(() => Ledger.restore(entries)).toThrow(RestoreError);
  });

  it("renumbers seq from 1", () => {
    const entries = [
      { txId: "dep:r1", seq: 100, accountId: "acc1", asset: "CASH", amount: 100n, direction: "CREDIT" as const, refEventId: "e1" },
      { txId: "dep:r1", seq: 200, accountId: EXTERNAL, asset: "CASH", amount: -100n, direction: "DEBIT" as const, refEventId: "e1" },
    ];
    const ledger = Ledger.restore(entries);
    const restored = ledger.entries();
    expect(restored[0]!.seq).toBe(1);
    expect(restored[1]!.seq).toBe(2);
  });

  it("groups non-contiguous legs by txId correctly", () => {
    const entries = [
      { txId: "trade:t1", seq: 1, accountId: "acc1", asset: "CASH", amount: -100n, direction: "DEBIT" as const, refEventId: "e1" },
      { txId: "dep:r1", seq: 2, accountId: "acc2", asset: "CASH", amount: 50n, direction: "CREDIT" as const, refEventId: "e2" },
      { txId: "dep:r1", seq: 3, accountId: EXTERNAL, asset: "CASH", amount: -50n, direction: "DEBIT" as const, refEventId: "e2" },
      { txId: "trade:t1", seq: 4, accountId: "acc2", asset: "CASH", amount: 100n, direction: "CREDIT" as const, refEventId: "e1" },
    ];
    const ledger = Ledger.restore(entries);
    expect(ledger.entries().filter((e) => e.txId === "trade:t1")).toHaveLength(2);
    expect(ledger.entries().filter((e) => e.txId === "dep:r1")).toHaveLength(2);
  });

  it("preserves txId set for idempotent posting", () => {
    const entries = [
      { txId: "dep:r1", seq: 1, accountId: "acc1", asset: "CASH", amount: 100n, direction: "CREDIT" as const, refEventId: "e1" },
      { txId: "dep:r1", seq: 2, accountId: EXTERNAL, asset: "CASH", amount: -100n, direction: "DEBIT" as const, refEventId: "e1" },
    ];
    const ledger = Ledger.restore(entries);
    const result = ledger.post({
      txId: "dep:r1",
      refEventId: "e1",
      legs: [
        { accountId: "acc1", asset: "CASH", amount: 100n },
        { accountId: EXTERNAL, asset: "CASH", amount: -100n },
      ],
    });
    expect(result.posted).toBe(false);
  });

  it("validates invariants after restore", () => {
    const entries = [
      { txId: "bad", seq: 1, accountId: "acc1", asset: "CASH", amount: 0n, direction: "CREDIT" as const, refEventId: "e1" },
    ];
    expect(() => Ledger.restore(entries)).toThrow(RestoreError);
  });
});
