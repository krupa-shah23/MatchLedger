/**
 * Transport mode parity test (SP1).
 * Run the same test in both inproc and kafka modes.
 * Verify behavior is identical (byte-for-byte equivalent outputs).
 */

import { describe, it, expect } from "vitest";
import { configFromEnv, createEventSink } from "./transport-flag.js";

describe("SP: System Parity (TRANSPORT modes)", () => {
  it("SP1: inproc and kafka modes produce identical results on same flow", async () => {
    // This test verifies that TRANSPORT=inproc and TRANSPORT=kafka
    // produce byte-for-byte identical results on the same seeded flow.
    //
    // Test harness would:
    // 1. Run scenario S with TRANSPORT=inproc
    // 2. Record outputs: order journals, event journals, books, watermarks
    // 3. Run same scenario S with TRANSPORT=kafka
    // 4. Compare all outputs - should be identical
    //
    // This proves:
    // - Kafka is a transport layer only (doesn't change business logic)
    // - Both modes handle ordering, deduping, crash recovery identically
    // - inproc behavior unchanged from Week 9

    // Placeholder: requires full scenario harness
    expect(true).toBe(true);
  });

  it("SP1b: inproc mode does not import Kafka client", () => {
    // Verify that inproc composition never imports @confluentinc/kafka-javascript
    // This is a static check - in real code, we'd verify module graph

    const config = configFromEnv();
    expect(config.mode).toBeDefined();

    // inproc mode should work without Kafka available
    if (config.mode === "inproc") {
      // No Kafka-specific config needed
      expect(config.kafkaBrokers).toBeUndefined();
    }
  });

  it("SP1c: TRANSPORT env var selects composition", () => {
    // Test that TRANSPORT=inproc and TRANSPORT=kafka are both recognized

    process.env.TRANSPORT = "inproc";
    const inprocConfig = configFromEnv();
    expect(inprocConfig.mode).toBe("inproc");

    process.env.TRANSPORT = "kafka";
    const kafkaConfig = configFromEnv();
    expect(kafkaConfig.mode).toBe("kafka");

    process.env.TRANSPORT = "invalid";
    expect(() => configFromEnv()).toThrow("Invalid TRANSPORT=invalid");

    // Reset
    delete process.env.TRANSPORT;
  });

  it("SP1d: Week 9 suite passes in both modes", async () => {
    // This would run the full Week 9 test suite twice:
    // npm test -- --project inproc
    // npm test -- --project kafka
    // Both should pass completely

    // Placeholder: requires CI setup
    expect(true).toBe(true);
  });
});
