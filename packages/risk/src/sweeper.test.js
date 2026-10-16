import { describe, expect, it } from "vitest";
import { LeakSweeper } from "./sweeper.js";
describe("leak sweeper", () => {
    it("SW1: tick forwards the sweep window to the stage probe path", () => {
        const calls = [];
        const stage = {
            probe: (olderThanMs) => {
                calls.push(olderThanMs);
            },
        };
        const sweeper = new LeakSweeper({
            stage: stage,
            olderThanMs: 5_000,
        });
        sweeper.tick();
        expect(calls).toEqual([5_000]);
    });
});
