import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { RiskConfig, RiskState, StampedRiskCommand } from "@matchledger/common";

import { RiskCore } from "./risk-core.js";
import { InvalidRiskStateError } from "./errors.js";

function cfg(): RiskConfig {
  return {
    instruments: new Map([
      ["ACME", { symbol: "ACME", tickSize: 1n, protectionBandBps: 500n, maxBandBps: 2000n, maxReferenceAgeMs: 60_000 }],
    ]),
  };
}

let seqCounter = 0;
function stamp(command: StampedRiskCommand["command"], ts = 1): StampedRiskCommand {
  seqCounter += 1;
  return { partition: 0, seq: seqCounter, ts, command };
}

function open(core: RiskCore, accountId: string): void {
  core.apply(stamp({ type: "OpenAccount", accountId }));
}

function deposit(core: RiskCore, accountId: string, amount: bigint, requestId: string): void {
  core.apply(stamp({ type: "Deposit", accountId, asset: "CASH", amount, requestId }));
}

function submitLimitBuy(core: RiskCore, orderId: string, accountId: string, qty: bigint, price: bigint): readonly unknown[] {
  return core.apply(
    stamp({
      type: "SubmitOrder",
      orderId,
      accountId,
      symbol: "ACME",
      side: "BUY",
      kind: "LIMIT",
      timeInForce: "GTC",
      quantity: qty,
      price,
      market: {},
    }),
  );
}

describe("RiskCore exportState/restore", () => {
  // RX1: exportState is canonical regardless of command ordering
  it("RX1: exportState is canonical", () => {
    const coreA = new RiskCore(cfg());
    open(coreA, "A");
    open(coreA, "B");
    deposit(coreA, "A", 100n, "d1");
    deposit(coreA, "B", 200n, "d2");

    const coreB = new RiskCore(cfg());
    open(coreB, "B");
    open(coreB, "A");
    deposit(coreB, "B", 200n, "d2b");
    deposit(coreB, "A", 100n, "d1b");

    const stateA = coreA.exportState();
    const stateB = coreB.exportState();
    expect(stateA.accounts).toEqual(stateB.accounts);

    // calling exportState twice is identical
    const stateA2 = coreA.exportState();
    expect(stateA).toEqual(stateA2);

    // arrays sorted lexicographically
    expect(stateA.accounts.map((a) => a.accountId)).toEqual(["A", "B"]);
  });

  // RX2: Isolation between core/state after export/restore
  it("RX2: isolation - mutating core after export doesn't affect exported state; mutating state copy doesn't affect restored core", () => {
    const core = new RiskCore(cfg());
    open(core, "A");
    deposit(core, "A", 500n, "d1");

    const exported = core.exportState();
    const snapshotCash = exported.accounts[0]!.cash;

    // Further mutate the live core
    deposit(core, "A", 999n, "d2");
    expect(exported.accounts[0]!.cash).toBe(snapshotCash);
    expect(core.accounts.get("A")?.cash).toBe(1499n);

    // Restore into a new core, then mutate a deep copy of state
    const restored = RiskCore.restore(cfg(), exported);
    const stateCopy = JSON.parse(JSON.stringify(exported, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as { accounts: { cash: string }[] };
    stateCopy.accounts[0]!.cash = "99999";
    expect(restored.accounts.get("A")?.cash).toBe(500n);
  });

  // RX3: Restore of an empty core's state
  it("RX3: restore of empty core state yields a healthy empty core with same config", () => {
    const core = new RiskCore(cfg());
    const exported = core.exportState();
    const restored = RiskCore.restore(cfg(), exported);
    expect(restored.accounts.size).toBe(0);
    expect(restored.reservations.size).toBe(0);
    expect(restored.checkInvariants()).toEqual([]);
  });

  // RX4: Restore after a scripted flow preserves behavior
  it("RX4: restore after submit+partial-fill, then close, matches an uninterrupted run", () => {
    // Uninterrupted reference core
    const ref = new RiskCore(cfg());
    open(ref, "A");
    deposit(ref, "A", 10_000n, "d1");
    submitLimitBuy(ref, "o1", "A", 10n, 105n); // reserve 1050
    ref.apply(stamp({ type: "FillApplied", orderId: "o1", tradeId: "t1", price: 101n, quantity: 4n }));
    const refClose = ref.apply(stamp({ type: "OrderClosed", orderId: "o1", remaining: 6n, reason: "CANCELLED" }));
    const refFinal = ref.exportState();

    // Interrupted: export/restore mid-flow, then finish on the restored core
    const core = new RiskCore(cfg());
    open(core, "A");
    deposit(core, "A", 10_000n, "d1");
    submitLimitBuy(core, "o1", "A", 10n, 105n);
    core.apply(stamp({ type: "FillApplied", orderId: "o1", tradeId: "t1", price: 101n, quantity: 4n }));

    const exported = core.exportState();
    const restored = RiskCore.restore(cfg(), exported);
    const restoredClose = restored.apply(stamp({ type: "OrderClosed", orderId: "o1", remaining: 6n, reason: "CANCELLED" }));
    const restoredFinal = restored.exportState();

    expect(restoredClose).toEqual(refClose);
    expect(restoredFinal).toEqual(refFinal);
    expect(restored.accounts.get("A")?.cash).toBe(10_000n - 404n);
    expect(restored.accounts.get("A")?.heldCash).toBe(0n);
  });

  // RX5: Dedupe sets and halted symbols survive restore
  it("RX5: dedupe state and halted symbols survive restore", () => {
    const core = new RiskCore(cfg());
    open(core, "A");
    deposit(core, "A", 10_000n, "d1");
    submitLimitBuy(core, "o1", "A", 10n, 105n);
    core.apply(stamp({ type: "HaltSymbol", symbol: "ACME" }));

    const exported = core.exportState();
    const restored = RiskCore.restore(cfg(), exported);

    // Duplicate SubmitOrder for already-decided order -> DuplicateIgnored
    const dupSubmit = restored.apply(
      stamp({
        type: "SubmitOrder",
        orderId: "o1",
        accountId: "A",
        symbol: "ACME",
        side: "BUY",
        kind: "LIMIT",
        timeInForce: "GTC",
        quantity: 10n,
        price: 105n,
        market: {},
      }),
    );
    expect(dupSubmit).toEqual([{ type: "DuplicateIgnored", kind: "ORDER", id: "o1" }]);

    // Duplicate deposit requestId -> DuplicateIgnored
    const dupDeposit = restored.apply(stamp({ type: "Deposit", accountId: "A", asset: "CASH", amount: 1n, requestId: "d1" }));
    expect(dupDeposit).toEqual([{ type: "DuplicateIgnored", kind: "DEPOSIT", id: "d1" }]);

    // Halted symbol still rejects new orders
    const haltedSubmit = restored.apply(
      stamp({
        type: "SubmitOrder",
        orderId: "o2",
        accountId: "A",
        symbol: "ACME",
        side: "BUY",
        kind: "LIMIT",
        timeInForce: "GTC",
        quantity: 1n,
        price: 10n,
        market: {},
      }),
    );
    expect(haltedSubmit[0]).toMatchObject({ type: "OrderRejected", reason: "SYMBOL_HALTED" });
  });

  // RX5b: Duplicate fill and duplicate adjustment ignored after restore
  it("RX5b: duplicate fill and duplicate adjustment ignored after restore", () => {
    const core = new RiskCore(cfg());
    open(core, "A");
    deposit(core, "A", 10_000n, "d1");
    submitLimitBuy(core, "o1", "A", 10n, 105n);
    core.apply(stamp({ type: "FillApplied", orderId: "o1", tradeId: "t1", price: 101n, quantity: 4n }));
    core.apply(stamp({ type: "ApplyAdjustment", adjustmentId: "adj1", accountId: "A", asset: "CASH", amount: 50n }));

    const restored = RiskCore.restore(cfg(), core.exportState());

    const dupFill = restored.apply(stamp({ type: "FillApplied", orderId: "o1", tradeId: "t1", price: 101n, quantity: 4n }));
    expect(dupFill).toEqual([{ type: "DuplicateIgnored", kind: "FILL", id: "t1" }]);

    const dupAdj = restored.apply(stamp({ type: "ApplyAdjustment", adjustmentId: "adj1", accountId: "A", asset: "CASH", amount: 50n }));
    expect(dupAdj.some((e: any) => e.type === "AccountAdjusted")).toBe(false);
  });

  // RX6: Malformed states throw InvalidRiskStateError with the right reason
  describe("RX6: malformed states rejected with the right reason", () => {
    function validState(): RiskState {
      const core = new RiskCore(cfg());
      open(core, "A");
      deposit(core, "A", 10_000n, "d1");
      submitLimitBuy(core, "o1", "A", 10n, 105n);
      return core.exportState();
    }

    it("version != 1 -> VERSION", () => {
      const state = { ...validState(), version: 2 } as unknown as RiskState;
      expect(() => RiskCore.restore(cfg(), state)).toThrow(InvalidRiskStateError);
      try {
        RiskCore.restore(cfg(), state);
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("VERSION");
      }
    });

    it("different instrument config -> CONFIG_MISMATCH", () => {
      const state = validState();
      const mismatchConfig: RiskConfig = { instruments: new Map([["OTHER", { symbol: "OTHER", tickSize: 1n, protectionBandBps: 1n, maxBandBps: 1n, maxReferenceAgeMs: 1 }]]) };
      try {
        RiskCore.restore(mismatchConfig, state);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("CONFIG_MISMATCH");
      }
    });

    it("duplicate reservation orderId -> DUPLICATE_RESERVATION", () => {
      const state = validState();
      const dup = { ...state, reservations: [...state.reservations, state.reservations[0]!] };
      try {
        RiskCore.restore(cfg(), dup);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("DUPLICATE_RESERVATION");
      }
    });

    it("reservation references missing account -> UNKNOWN_ACCOUNT", () => {
      const state = validState();
      const corrupted = { ...state, accounts: [] };
      try {
        RiskCore.restore(cfg(), corrupted);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("UNKNOWN_ACCOUNT");
      }
    });

    it("reservation orderId absent from decidedOrders -> RESERVATION_NOT_DECIDED", () => {
      const state = validState();
      const corrupted = { ...state, decidedOrders: [] };
      try {
        RiskCore.restore(cfg(), corrupted);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("RESERVATION_NOT_DECIDED");
      }
    });

    it("BUY amountRemaining mismatch -> AMOUNT_MISMATCH", () => {
      const state = validState();
      const corrupted = {
        ...state,
        reservations: state.reservations.map((r) => ({ ...r, amountRemaining: r.amountRemaining + 1n })),
      };
      try {
        RiskCore.restore(cfg(), corrupted);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("AMOUNT_MISMATCH");
      }
    });

    it("heldCash not equal to sum of BUY reservations -> HELD_MISMATCH", () => {
      const state = validState();
      const corrupted = {
        ...state,
        accounts: state.accounts.map((a) => (a.accountId === "A" ? { ...a, heldCash: a.heldCash + 1n, cash: a.cash + 1n } : a)),
      };
      try {
        RiskCore.restore(cfg(), corrupted);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("HELD_MISMATCH");
      }
    });

    it("heldCash > cash -> NEGATIVE", () => {
      const state = validState();
      const acct = state.accounts.find((a) => a.accountId === "A")!;
      const corrupted = {
        ...state,
        accounts: state.accounts.map((a) => (a.accountId === "A" ? { ...a, cash: acct.heldCash - 1n } : a)),
      };
      try {
        RiskCore.restore(cfg(), corrupted);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("NEGATIVE");
      }
    });

    it("negative qtyRemaining -> NEGATIVE", () => {
      const state = validState();
      const corrupted = {
        ...state,
        reservations: state.reservations.map((r) => ({ ...r, qtyRemaining: -1n, amountRemaining: r.priceCap * -1n })),
      };
      try {
        RiskCore.restore(cfg(), corrupted);
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as InvalidRiskStateError).reason).toBe("NEGATIVE");
      }
    });
  });

  // RX7: checkInvariants gate catches cases restore()'s itemized checks miss by construction
  it("RX7: checkInvariants gate rejects a state that passes itemized validation but violates invariants", () => {
    const core = new RiskCore(cfg());
    open(core, "A");
    deposit(core, "A", 10_000n, "d1");
    submitLimitBuy(core, "o1", "A", 5n, 2n); // reserve 10 (priceCap=2, qty=5)

    const base = core.exportState();
    // Construct a second BUY reservation with a negative priceCap, chosen so that
    // its (negative) amountRemaining exactly cancels against the first reservation's
    // contribution to heldCash. This passes AMOUNT_MISMATCH (internally consistent),
    // HELD_MISMATCH (sums still match heldCash) and every other itemized restore()
    // check, yet leaves a reservation with a negative amountRemaining in the built
    // core -- which only checkInvariants() detects.
    const extraReservation: RiskState["reservations"][number] = {
      orderId: "o2",
      accountId: "A",
      symbol: "ACME",
      side: "BUY" as const,
      priceCap: -1n,
      qtyRemaining: 5n,
      amountRemaining: -5n,
      state: "PENDING_ACK" as const,
      placedTs: 1,
      placedSeq: 999,
      appliedTradeIds: [],
    };
    const corrupted: RiskState = {
      ...base,
      decidedOrders: [...base.decidedOrders, "o2"].sort(),
      reservations: [...base.reservations, extraReservation].sort((a, b) => a.placedSeq - b.placedSeq),
      accounts: base.accounts.map((a) => (a.accountId === "A" ? { ...a, heldCash: a.heldCash - 5n } : a)),
    };

    try {
      RiskCore.restore(cfg(), corrupted);
      expect.fail("should have thrown INVARIANT");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidRiskStateError);
      expect((err as InvalidRiskStateError).reason).toBe("INVARIANT");
    }
  });
});

describe("P24: export/restore round trip property", () => {
  it("P24: restoring mid-flow and continuing matches an uninterrupted run (numRuns >= 200)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 2, maxLength: 20 }),
        fc.nat({ max: 19 }),
        (quantities, cutRaw) => {
          const cut = Math.min(cutRaw, quantities.length - 1);

          function buildCommands(): StampedRiskCommand[] {
            let localSeq = 0;
            const cmds: StampedRiskCommand[] = [];
            const push = (command: StampedRiskCommand["command"]) => {
              localSeq += 1;
              cmds.push({ partition: 0, seq: localSeq, ts: localSeq, command });
            };
            push({ type: "OpenAccount", accountId: "A" });
            push({ type: "Deposit", accountId: "A", asset: "CASH", amount: 1_000_000n, requestId: "seed" });
            quantities.forEach((q, i) => {
              push({
                type: "SubmitOrder",
                orderId: `o${i}`,
                accountId: "A",
                symbol: "ACME",
                side: "BUY",
                kind: "LIMIT",
                timeInForce: "GTC",
                quantity: BigInt(q),
                price: 10n,
                market: {},
              });
            });
            return cmds;
          }

          const commands = buildCommands();

          const coreA = new RiskCore(cfg());
          for (const c of commands) coreA.apply(c);
          const finalA = coreA.exportState();

          const coreB = new RiskCore(cfg());
          const splitIdx = 2 + cut; // after seeding, cut partway through submits
          for (let i = 0; i < splitIdx && i < commands.length; i++) coreB.apply(commands[i]!);
          const exported = coreB.exportState();
          const coreC = RiskCore.restore(cfg(), exported);
          for (let i = splitIdx; i < commands.length; i++) coreC.apply(commands[i]!);
          const finalC = coreC.exportState();

          expect(finalC).toEqual(finalA);
          expect(coreC.checkInvariants()).toEqual([]);
        },
      ),
      { numRuns: 200 },
    );
  });
});
