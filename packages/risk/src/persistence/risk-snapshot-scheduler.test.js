import { describe, it, expect } from "vitest";
import { RiskSnapshotScheduler } from "./risk-snapshot-scheduler.js";
import { RiskCore } from "../core/risk-core.js";
describe("RiskSnapshotScheduler (RSC1)", () => {
    // RSC1: snapshots when due using the context's lastSeq; failure non-fatal, retried
    it("RSC1: snapshots exactly when due; a failed save is non-fatal and retried next batch", async () => {
        const saved = [];
        let failNext = false;
        const errors = [];
        const fakeStore = {
            save: async (partition, lastSeq) => {
                if (failNext) {
                    failNext = false;
                    throw new Error("disk full");
                }
                saved.push({ partition, lastSeq });
            },
        };
        const scheduler = new RiskSnapshotScheduler(fakeStore, 10, (err) => errors.push(err));
        const core = new RiskCore({ instruments: new Map() });
        await scheduler.afterBatch({ partition: 0, lastSeq: 5, lastTs: 5, core });
        expect(saved).toHaveLength(0); // not due yet (5 < 10)
        await scheduler.afterBatch({ partition: 0, lastSeq: 10, lastTs: 10, core });
        expect(saved).toEqual([{ partition: 0, lastSeq: 10 }]); // due at 10
        await scheduler.afterBatch({ partition: 0, lastSeq: 15, lastTs: 15, core });
        expect(saved).toHaveLength(1); // not due yet (15 - 10 = 5 < 10)
        // Failure case: due again at 20, but the store throws
        failNext = true;
        await scheduler.afterBatch({ partition: 0, lastSeq: 20, lastTs: 20, core });
        expect(saved).toHaveLength(1); // still 1 - failure did not advance lastSnapshotSeq
        expect(errors).toHaveLength(1);
        // Retried on the NEXT batch since lastSnapshotSeq is still 10 -> due again at >= 20
        await scheduler.afterBatch({ partition: 0, lastSeq: 21, lastTs: 21, core });
        expect(saved).toEqual([{ partition: 0, lastSeq: 10 }, { partition: 0, lastSeq: 21 }]);
    });
});
