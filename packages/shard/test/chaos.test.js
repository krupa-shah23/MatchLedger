import { describe, it } from "vitest";
describe("R1-R3: Chaos", () => {
    it.todo("R1: recover from an engine crash at any of the crash windows without losing or duplicating a command");
    it.todo("R2: recover from a torn snapshot and fall back to the last valid snapshot");
    it.todo("R3: deduplicate repeated engine sequences without throwing a gap error");
});
