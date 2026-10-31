import { describe, it, expect } from "vitest";
import { loadStartupConfig } from "./startup-config.js";

describe("API startup configuration", () => {
  it("has validated in-process defaults and bigint instrument specs", () => {
    const config = loadStartupConfig({});
    expect(config.TRANSPORT).toBe("inproc");
    expect(config.instruments[0]?.tickSize).toBe(1n);
    expect(config.HEARTBEAT_MS).toBe(5000);
  });
  it("rejects unknown API transport and invalid runtime limits", () => {
    expect(loadStartupConfig({ TRANSPORT: "kafka" }).TRANSPORT).toBe("kafka");
    expect(() => loadStartupConfig({ TRANSPORT: "invalid" })).toThrow();
    expect(() => loadStartupConfig({ QUEUE_CAPACITY: "0" })).toThrow();
    expect(() => loadStartupConfig({ SIMULATOR_RATE_CAP: "-1" })).toThrow();
    expect(() => loadStartupConfig({ INSTRUMENTS_JSON: '[{"symbol":"ABC"}]' })).toThrow();
  });
});
