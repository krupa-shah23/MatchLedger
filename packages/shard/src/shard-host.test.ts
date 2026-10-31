/**
 * ShardHost metrics tests (TL5-TL6)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { METRICS_CATALOGUE } from "@matchledger/telemetry";

describe("ShardHost Metrics (TL5-TL6)", () => {
  it("TL5: Catalogue contains ml_shard_commands_total with shard_id and symbol labels", () => {
    const metric = METRICS_CATALOGUE["ml_shard_commands_total"];
    expect(metric).toBeDefined();
    expect(metric?.type).toBe("counter");
    expect(metric?.labelNames).toContain("shard_id");
    expect(metric?.labelNames).toContain("symbol");
  });

  it("TL6: Catalogue contains queue and depth metrics", () => {
    const fullMetric = METRICS_CATALOGUE["ml_shard_queue_full"];
    const depthMetric = METRICS_CATALOGUE["ml_shard_queue_depth"];
    const lastSeqMetric = METRICS_CATALOGUE["ml_shard_last_seq"];
    const leaseEpochMetric = METRICS_CATALOGUE["ml_shard_lease_epoch"];
    const ownershipMetric = METRICS_CATALOGUE["ml_shard_ownership_changes"];

    expect(fullMetric).toBeDefined();
    expect(fullMetric?.type).toBe("counter");
    expect(depthMetric).toBeDefined();
    expect(depthMetric?.type).toBe("gauge");
    expect(lastSeqMetric).toBeDefined();
    expect(lastSeqMetric?.type).toBe("gauge");
    expect(leaseEpochMetric).toBeDefined();
    expect(ownershipMetric).toBeDefined();
  });
});

describe("Heartbeat Writer and Recovery Logging (HT1, RG1, RG3)", () => {
  it("HT1: Catalogue contains heartbeat latency metric", () => {
    const metric = METRICS_CATALOGUE["ml_shard_heartbeat_latency_ms"];
    expect(metric).toBeDefined();
    expect(metric?.type).toBe("histogram");
    expect(metric?.labelNames).toContain("shard_id");
  });

  it("HT1b: writeHeartbeat's upsert is unfenced - no WHERE clause conditions the write on last_seq", () => {
    // Real source-level check on the actual implementation. A heartbeat is
    // pure liveness: it must always overwrite last_heartbeat_at/last_seq,
    // never be skipped because this write's last_seq looks "behind" some
    // other row - that fencing belongs to the journal, not the heartbeat.
    const source = readFileSync(fileURLToPath(new URL("./shard-host.ts", import.meta.url)), "utf8");
    const start = source.indexOf("private async writeHeartbeat(");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\n  }\n", start));
    const queryStart = body.indexOf("INSERT INTO shard_heartbeats");
    const queryEnd = body.indexOf("`,", queryStart);
    const query = body.slice(queryStart, queryEnd);
    expect(query).not.toMatch(/WHERE/i);
  });

  it("RG1: Catalogue contains recovery metrics", () => {
    const durationMetric = METRICS_CATALOGUE["ml_recovery_duration_ms"];
    const seqMetric = METRICS_CATALOGUE["ml_recovery_snapshot_seq"];
    const tailLengthMetric = METRICS_CATALOGUE["ml_recovery_tail_length"];

    expect(durationMetric).toBeDefined();
    expect(durationMetric?.type).toBe("gauge");
    expect(seqMetric).toBeDefined();
    expect(seqMetric?.type).toBe("gauge");
    expect(tailLengthMetric).toBeDefined();
    expect(tailLengthMetric?.type).toBe("gauge");
  });

  it("RG3: Recovery metrics have shard_id label", () => {
    const durationMetric = METRICS_CATALOGUE["ml_recovery_duration_ms"];
    const seqMetric = METRICS_CATALOGUE["ml_recovery_snapshot_seq"];
    const tailLengthMetric = METRICS_CATALOGUE["ml_recovery_tail_length"];

    expect(durationMetric?.labelNames).toContain("shard_id");
    expect(seqMetric?.labelNames).toContain("shard_id");
    expect(tailLengthMetric?.labelNames).toContain("shard_id");
  });
});
