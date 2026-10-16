import { describe, it } from "vitest";
describe.skipIf(process.env.RUN_KAFKA_SPIKE !== "1")("Spike 4 Kafka transactions", () => it("runs the documented live probe", async () => { await import("./spike4.js"); }, 60_000));
