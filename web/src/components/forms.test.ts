/**
 * SUPERSEDED: this file previously asserted UF1-UF5 against standalone
 * closures defined inline inside each test, never importing or rendering
 * the real OrderEntry component - so no change to OrderEntry.tsx could
 * ever fail these tests (confirmed by mutation testing: mutations 11/12 in
 * tools/mutations-week11.json "survived" for exactly this reason). The
 * real UF1-UF5 coverage, rendering the actual OrderEntry component with a
 * stubbed fetch, now lives in ./OrderEntry.test.tsx.
 */
import { describe, it, expect } from "vitest";
import { OrderEntry } from "./OrderEntry.js";

describe("Order form validation and handling (superseded by OrderEntry.test.tsx)", () => {
  it("OrderEntry component is exported for real UF1-UF5 coverage in OrderEntry.test.tsx", () => {
    expect(typeof OrderEntry).toBe("function");
  });
});
