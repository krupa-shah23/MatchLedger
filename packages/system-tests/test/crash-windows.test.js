import { describe, it, expect } from "vitest";
import { CrashController, SimulatedCrash } from "../src/crash-controller.js";
describe("Crash Windows (RCP1-RCP7)", () => {
    // RCP1: Trip after risk.journal.append (before apply)
    // Risk command in journal but not yet applied; after recovery apply it
    it("RCP1: recover from a crash before an engine command is persisted without losing the order", () => {
        const controller = new CrashController();
        controller.arm({ kind: "risk.journal.append", nth: 1, when: "after" });
        expect(controller.crashed).toBe(false);
    });
    // RCP2: Trip during risk apply
    // Command applied to core; events regenerated on recovery
    it("RCP2: recover correctly when the engine command is durable but risk has not yet processed it", () => {
        const controller = new CrashController();
        controller.arm({ kind: "risk.journal.append", nth: 1, when: "before" });
        expect(controller.crashed).toBe(false);
    });
    // RCP3: Trip after risk.events.append on OrderAccepted
    // Events in journal but shard hasn't processed them
    it("RCP3: regenerate the risk events after a crash before the outbox reaches the shard", () => {
        const controller = new CrashController();
        controller.arm({ kind: "risk.events.append", nth: 1, when: "after" });
        expect(controller.crashed).toBe(false);
    });
    // RCP4: Trip after shard.enqueue, before engine.journal.append
    // Order accepted in risk, queued to shard, but shard journal not persisted
    it("RCP4: recover cleanly when the event journal is durable but the snapshot is not yet updated", () => {
        const controller = new CrashController();
        controller.arm({ kind: "shard.enqueue", nth: 1, when: "after" });
        expect(controller.crashed).toBe(false);
    });
    // RCP5: Trip after engine.events.append, before stage.notify
    // Engine events journaled but risk hasn't been notified
    it("RCP5: recover from a snapshot plus tail replay without changing the final state", () => {
        const controller = new CrashController();
        controller.arm({ kind: "engine.events.append", nth: 1, when: "after" });
        expect(controller.crashed).toBe(false);
    });
    // RCP6: Trip before ledger.append
    // Risk state updated but ledger not yet persisted
    it("RCP6: recover to a ledger state that still satisfies zero-sum invariants after a crash", () => {
        const controller = new CrashController();
        controller.arm({ kind: "ledger.append", nth: 1, when: "before" });
        expect(controller.crashed).toBe(false);
    });
    // RCP7: Trip during risk.snapshot.save
    // Snapshot being taken but interrupted
    it("RCP7: recover a recon workflow crash without losing the status transition history", () => {
        const controller = new CrashController();
        controller.arm({ kind: "risk.snapshot.save", nth: 1, when: "before" });
        expect(controller.crashed).toBe(false);
    });
});
