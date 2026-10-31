/**
 * Transport mode parity test (SP1).
 *
 * IMPORTANT SCOPE CORRECTION: this file previously asserted end-to-end
 * TRANSPORT=inproc/kafka parity via `expect(true).toBe(true)` placeholders.
 * That claim cannot be verified at this level: createEventSink/configFromEnv
 * in ./transport-flag.ts are dead code - createLiveRuntime (live-runtime.ts)
 * never calls them, and the shard process (packages/shard/src/main.ts) has
 * its own independent Kafka wiring that also never calls them. The real
 * system is two separate binaries (API hardcoded to TRANSPORT=inproc, shard
 * hardcoded to TRANSPORT=kafka), not one composition root switchable by a
 * flag. True cross-process parity requires running both real binaries
 * against the same seeded order flow and diffing journals - that is a live
 * integration check, not a unit test, and is tracked separately (see the
 * live-verification pass for genuine SP1 parity across both transports).
 *
 * What *is* real and testable here: this module's own config parsing and
 * its claim not to import the Kafka client in inproc mode.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { configFromEnv, createEventSink } from "./transport-flag.js";

describe("SP: System Parity (TRANSPORT modes)", () => {
  // SKIPPED (not faked). Reason: verifying that the API's inproc
  // composition (createLiveRuntime) and the shard's kafka composition
  // produce identical journal/order outcomes for the same seeded flow
  // requires starting both real binaries and diffing Postgres state - see
  // the live-verification task for the genuine multi-process run and
  // recorded evidence.
  it.skip("SP1: cross-process inproc/kafka journal parity - requires live multi-process harness, not a unit test", () => {});

  it("SP1b: inproc branch contains no reference to the Kafka client, statically", async () => {
    // Static module-graph check on the real source: the kafka import must
    // appear only inside the `mode === "kafka"` branch, never at module
    // top-level and never inside the inproc branch - so loading this module
    // and calling createEventSink({mode:"inproc"}) can never pull in Kafka.
    const source = readFileSync(fileURLToPath(new URL("./transport-flag.ts", import.meta.url)), "utf8");
    const [, , afterInprocBranch] = source.split(/mode === "inproc"|mode === "kafka"/);
    expect(source).not.toMatch(/^import .*@matchledger\/transport/m);
    expect(afterInprocBranch ?? "").toContain("@matchledger/transport");

    const sink = await createEventSink({ mode: "inproc" });
    expect(sink).toBeDefined();
    await sink.publish([]);
  });

  it("SP1c: TRANSPORT env var selects composition and rejects invalid values", () => {
    process.env.TRANSPORT = "inproc";
    const inprocConfig = configFromEnv();
    expect(inprocConfig.mode).toBe("inproc");

    process.env.TRANSPORT = "kafka";
    const kafkaConfig = configFromEnv();
    expect(kafkaConfig.mode).toBe("kafka");

    process.env.TRANSPORT = "invalid";
    expect(() => configFromEnv()).toThrow("Invalid TRANSPORT=invalid");

    delete process.env.TRANSPORT;
  });

  // SKIPPED (not faked). Reason: this asserts the full Week 9 vitest suite
  // passes twice (once per TRANSPORT value) under a CI matrix; a single
  // test file cannot re-invoke the whole suite meaningfully. Tracked as a
  // CI configuration task, not unit-test coverage.
  it.skip("SP1d: Week 9 suite passes under both TRANSPORT values - requires CI matrix, not a unit test", () => {});
});
