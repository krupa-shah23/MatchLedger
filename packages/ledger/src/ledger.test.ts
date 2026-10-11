import { describe, expect, it } from "vitest";

import { MAX_AMOUNT } from "@matchledger/common";

import { EXTERNAL, Ledger, UnbalancedTransactionError } from "./ledger.js";

describe("ledger", () => {
  it("LG1: balanced deposit and trade are accepted", () => {
    const ledger = new Ledger();
    expect(ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 1_000n, requestId: "d1", refEventId: "e1" }).posted).toBe(true);
    expect(ledger.postDeposit({ accountId: "B", asset: "SHARES:ACME", amount: 10n, requestId: "d2", refEventId: "e2" }).posted).toBe(true);
    expect(
      ledger.postTrade(
        {
          tradeId: "t1",
          symbol: "ACME",
          price: 100n,
          quantity: 4n,
          buyerAccountId: "A",
          sellerAccountId: "B",
        },
        "e3",
      ).posted,
    ).toBe(true);
    expect(ledger.assetTotal("CASH")).toBe(0n);
    expect(ledger.assetTotal("SHARES:ACME")).toBe(0n);
    expect(ledger.checkInvariants()).toStrictEqual([]);
  });

  it("LG2: unbalanced tx throws and appends nothing", () => {
    const ledger = new Ledger();
    expect(() =>
      ledger.post({
        txId: "bad1",
        refEventId: "e1",
        legs: [
          { accountId: "A", asset: "CASH", amount: 10n },
          { accountId: "B", asset: "CASH", amount: -5n },
        ],
      }),
    ).toThrow(UnbalancedTransactionError);
    expect(ledger.entries()).toHaveLength(0);
  });

  it("LG3: duplicate txId is a no-op", () => {
    const ledger = new Ledger();
    const first = ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 50n, requestId: "r1", refEventId: "e1" });
    const second = ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 50n, requestId: "r1", refEventId: "e2" });
    expect(first.posted).toBe(true);
    expect(second.posted).toBe(false);
    expect(ledger.entries()).toHaveLength(2);
  });

  it("LG4: reverse(txId) negates entries and reversing again no-ops", () => {
    const ledger = new Ledger();
    ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 100n, requestId: "r1", refEventId: "e1" });
    const before = ledger.balance("A", "CASH");
    expect(ledger.reverse("dep:r1").posted).toBe(true);
    expect(ledger.balance("A", "CASH")).toBe(0n);
    expect(ledger.reverse("dep:r1").posted).toBe(false);
    expect(ledger.balance("A", "CASH")).toBe(0n);
    expect(before).toBe(100n);
  });

  it("LG5: entries() returns frozen copies", () => {
    const ledger = new Ledger();
    ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 25n, requestId: "r1", refEventId: "e1" });
    const entries = ledger.entries();
    const first = entries[0];
    expect(Object.isFrozen(entries)).toBe(true);
    expect(first !== undefined && Object.isFrozen(first)).toBe(true);
    const mutated = { ...first };
    mutated.amount = 99n;
    expect(ledger.balance("A", "CASH")).toBe(25n);
    expect(ledger.balance("A", "CASH")).toBe(25n);
  });

  it("LG6: balance and per-symbol positions including @EXTERNAL", () => {
    const ledger = new Ledger();
    ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 1_000n, requestId: "r1", refEventId: "e1" });
    ledger.postDeposit({ accountId: "B", asset: "SHARES:ACME", amount: 10n, requestId: "r2", refEventId: "e2" });
    ledger.postTrade(
      {
        tradeId: "trade1",
        symbol: "ACME",
        price: 100n,
        quantity: 4n,
        buyerAccountId: "A",
        sellerAccountId: "B",
      },
      "e3",
    );
    expect(ledger.balance("A", "CASH")).toBe(600n);
    expect(ledger.balance("A", "SHARES:ACME")).toBe(4n);
    expect(ledger.balance("B", "CASH")).toBe(400n);
    expect(ledger.balance("B", "SHARES:ACME")).toBe(6n);
    expect(ledger.balance(EXTERNAL, "CASH")).toBe(-1_000n);
    expect(ledger.balance(EXTERNAL, "SHARES:ACME")).toBe(-10n);
  });

  it("LG7: direction and sign reflect debit/credit semantics", () => {
    const ledger = new Ledger();
    ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 15n, requestId: "r1", refEventId: "e1" });
    ledger.postTrade(
      {
        tradeId: "t1",
        symbol: "ACME",
        price: 5n,
        quantity: 2n,
        buyerAccountId: "A",
        sellerAccountId: "B",
      },
      "e2",
    );
    const entries: readonly { amount: bigint; direction: "DEBIT" | "CREDIT" }[] = ledger.entries();
    expect(entries.some((entry) => entry.amount < 0n && entry.direction === "DEBIT")).toBe(true);
    expect(entries.some((entry) => entry.amount > 0n && entry.direction === "CREDIT")).toBe(true);
  });

  it("LG8: amount bounds and zero values are rejected", () => {
    const ledger = new Ledger();
    expect(() => ledger.post({ txId: "bad", refEventId: "e1", legs: [{ accountId: "A", asset: "CASH", amount: 0n }] })).toThrow(RangeError);
    expect(() => ledger.post({ txId: "bad2", refEventId: "e1", legs: [{ accountId: "A", asset: "CASH", amount: MAX_AMOUNT + 1n }] })).toThrow(RangeError);
  });

  it("P5: random valid postings always maintain asset totals and invariants", () => {
    const ledger = new Ledger();
    const txs = [
      { txId: "d1", refEventId: "e1", legs: [{ accountId: "A", asset: "CASH", amount: 250n }, { accountId: EXTERNAL, asset: "CASH", amount: -250n }] },
      { txId: "d2", refEventId: "e2", legs: [{ accountId: "B", asset: "SHARES:ACME", amount: 8n }, { accountId: EXTERNAL, asset: "SHARES:ACME", amount: -8n }] },
      { txId: "t1", refEventId: "e3", legs: [{ accountId: "A", asset: "CASH", amount: -80n }, { accountId: "B", asset: "CASH", amount: 80n }, { accountId: "A", asset: "SHARES:ACME", amount: 2n }, { accountId: "B", asset: "SHARES:ACME", amount: -2n }] },
    ];
    for (const tx of txs) {
      expect(ledger.post(tx).posted).toBe(true);
      expect(ledger.checkInvariants()).toStrictEqual([]);
    }
    expect(ledger.assetTotal("CASH")).toBe(0n);
    expect(ledger.assetTotal("SHARES:ACME")).toBe(0n);
  });

  it("P6: symbol totals across all accounts including @EXTERNAL sum to zero", () => {
    const ledger = new Ledger();
    ledger.postDeposit({ accountId: "A", asset: "CASH", amount: 500n, requestId: "a1", refEventId: "e1" });
    ledger.postDeposit({ accountId: "B", asset: "SHARES:ACME", amount: 5n, requestId: "b1", refEventId: "e2" });
    ledger.postTrade(
      {
        tradeId: "trade1",
        symbol: "ACME",
        price: 30n,
        quantity: 2n,
        buyerAccountId: "A",
        sellerAccountId: "B",
      },
      "e3",
    );
    expect(ledger.balance("A", "SHARES:ACME") + ledger.balance("B", "SHARES:ACME") + ledger.balance(EXTERNAL, "SHARES:ACME")).toBe(0n);
  });
});
