import { expect } from "vitest";
import type { Engine } from "../../src/matching/engine.js";

export const assertInvariants = (engine: Engine): void => {
  const violations = engine.checkInvariants();
  expect(violations, violations.join("; ")).toEqual([]);
};
