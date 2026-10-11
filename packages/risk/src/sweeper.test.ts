import { describe, expect, it } from "vitest";

import { LeakSweeper } from "./sweeper.js";

describe("leak sweeper", () => {
  it("SW1: tick forwards the sweep window to the stage probe path", () => {
    const calls: number[] = [];
    const stage = {
      probe: (olderThanMs: number): void => {
        calls.push(olderThanMs);
      },
    } as { probe: (olderThanMs: number) => void };

    const sweeper = new LeakSweeper({
      stage: stage as never,
      olderThanMs: 5_000,
    });

    sweeper.tick();

    expect(calls).toEqual([5_000]);
  });
});
