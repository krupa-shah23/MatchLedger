/**
 * BD1: Boundary checker test
 * Verifies that seeded violations are detected and reported
 */

import { describe, it, expect } from "vitest";
import { findForbiddenDependencies } from "./check-boundaries.mjs";

describe("BD1: Boundary Checker", () => {
  it("BD1: Detects seeded web, telemetry, and simulator dependency violations", () => {
    const violations = [
      findForbiddenDependencies({ dependencies: { "@matchledger/api": "*" } }, ["react"], "web/package.json"),
      findForbiddenDependencies({ dependencies: { "@matchledger/engine-core": "*" } }, ["prom-client"], "packages/telemetry/package.json"),
      findForbiddenDependencies({ dependencies: { "@matchledger/transport": "*" } }, ["@matchledger/common", "@confluentinc/kafka-javascript"], "packages/simulator/package.json"),
    ].flat();

    expect(violations).toHaveLength(3);
    expect(violations).toContainEqual(expect.stringContaining("web/package.json"));
    expect(violations).toContainEqual(expect.stringContaining("packages/telemetry/package.json"));
    expect(violations).toContainEqual(expect.stringContaining("packages/simulator/package.json"));
  });
});
