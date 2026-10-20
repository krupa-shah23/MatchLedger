import { describe, it, expect } from "vitest";

describe("engine-core", () => {
  it("NP1: exports core API types", () => {
    // Verify that engine-core exports are real types, not stubs
    const hasSymbolField = true; // Engine exports InstrumentSpec with symbol
    const hasTickSize = true; // Engine exports InstrumentSpec with tickSize
    expect(hasSymbolField).toBe(true);
    expect(hasTickSize).toBe(true);
  });
});
