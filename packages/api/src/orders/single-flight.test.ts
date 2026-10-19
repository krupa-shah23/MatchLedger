/**
 * OA10, OA10b: Single-flight deduplication tests
 */

import { describe, it, expect } from "vitest";
import { SingleFlight } from "./single-flight.js";

describe("OA: Single-Flight", () => {
  it("OA10: Concurrent identical requests share one execution", async () => {
    const sf = new SingleFlight<string>();
    let execCount = 0;

    const work = async () => {
      execCount++;
      return "result";
    };

    // Launch 50 concurrent requests with the same key
    const promises = Array.from({ length: 50 }, () => sf.run("order-1", work));
    const results = await Promise.all(promises);

    // All should get the same result
    expect(results).toHaveLength(50);
    expect(new Set(results).size).toBe(1); // All identical
    expect(results[0]).toBe("result");

    // But work should have run only once
    expect(execCount).toBe(1);
  });

  it("OA10b: Failed single-flight execution frees the key", async () => {
    const sf = new SingleFlight<string>();
    let execCount = 0;

    const failingWork = async () => {
      execCount++;
      throw new Error("Work failed");
    };

    const successWork = async () => {
      execCount++;
      return "success";
    };

    // First execution fails
    try {
      await sf.run("order-1", failingWork);
    } catch {
      // Expected
    }

    // Key should be freed: next request runs independently
    const result = await sf.run("order-1", successWork);
    expect(result).toBe("success");
    expect(execCount).toBe(2); // Both executions ran
  });

  it("OA10: Different keys run independently", async () => {
    const sf = new SingleFlight<string>();
    let execCount = 0;

    const work = async () => {
      execCount++;
      return "result";
    };

    const p1 = sf.run("key-1", work);
    const p2 = sf.run("key-2", work);

    await Promise.all([p1, p2]);

    expect(execCount).toBe(2); // Each key ran once
  });
});
