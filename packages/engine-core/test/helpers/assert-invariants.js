import { expect } from "vitest";
export const assertInvariants = (engine) => {
    const violations = engine.checkInvariants();
    expect(violations, violations.join("; ")).toEqual([]);
};
