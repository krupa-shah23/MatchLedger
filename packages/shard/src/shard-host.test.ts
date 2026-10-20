/**
 * ShardHost metrics tests (TL5-TL6)
 */

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
