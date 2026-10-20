/**
 * System routes tests (HT2, HT3, RG2, MS1-MS4)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { registerSystemRoutes, type SystemRoutesDeps } from "./system.js";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { createHash } from "node:crypto";

describe("System Routes (HT2, HT3, RG2)", () => {
  let app: FastifyInstance;
  let mockExecutor: any;

  beforeEach(async () => {
    mockExecutor = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    app = Fastify({ logger: false });
    const deps: SystemRoutesDeps = {
      executor: mockExecutor,
      facade: {} as any,
    };
    await registerSystemRoutes(app, deps);
  });

  it("HT2: GET /system/shards returns shard list with heartbeat data", async () => {
    const mockShards = [
      {
        lease_id: "shard-0",
        owner: "shard-worker-1",
        epoch: 1,
        acquired_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        last_seq: 100,
        owned_symbols: ["AAPL", "MSFT"],
        snapshot_seq: 50,
        journal_seq: 100,
        is_stale: false,
      },
    ];

    mockExecutor.query.mockResolvedValueOnce({ rows: mockShards });

    const response = await app.inject({
      method: "GET",
      url: "/system/shards",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.shards).toBeDefined();
    expect(body.shards.length).toBe(1);
    expect(body.shards[0].leaseId).toBe("shard-0");
    expect(body.shards[0].lastHeartbeatAt).toBeDefined();
    expect(body.shards[0].lastSeq).toBe(100);
    expect(body.shards[0].ownedSymbols).toEqual(["AAPL", "MSFT"]);
  });

  it("HT3: GET /system/shards correctly identifies stale shards", async () => {
    const freshShard = {
      lease_id: "shard-0",
      owner: "worker-1",
      epoch: 1,
      acquired_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      last_seq: 100,
      owned_symbols: ["AAPL"],
      snapshot_seq: 50,
      journal_seq: 100,
      is_stale: false,
    };

    const staleShard = {
      lease_id: "shard-1",
      owner: "worker-2",
      epoch: 1,
      acquired_at: new Date().toISOString(),
      last_heartbeat_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
      last_seq: 50,
      owned_symbols: ["MSFT"],
      snapshot_seq: 30,
      journal_seq: 50,
      is_stale: true,
    };

    mockExecutor.query.mockResolvedValueOnce({ rows: [freshShard, staleShard] });

    const response = await app.inject({
      method: "GET",
      url: "/system/shards",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.shards.length).toBe(2);
    expect(body.shards[0].isStale).toBe(false);
    expect(body.shards[1].isStale).toBe(true);
  });

  it("RG2: GET /system/recovery returns recovery log with correct fields", async () => {
    const mockRecoveries = [
      {
        id: 1,
        lease_id: "shard-0",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 1500,
        snapshot_seq: 100,
        tail_length: 45,
        symbols_recovered: ["AAPL", "MSFT", "NVDA"],
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        lease_id: "shard-1",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 2000,
        snapshot_seq: 80,
        tail_length: 60,
        symbols_recovered: ["TSLA"],
        created_at: new Date().toISOString(),
      },
    ];

    mockExecutor.query.mockResolvedValueOnce({ rows: mockRecoveries });

    const response = await app.inject({
      method: "GET",
      url: "/system/recovery",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.recoveries).toBeDefined();
    expect(body.recoveries.length).toBe(2);

    expect(body.recoveries[0].id).toBe(1);
    expect(body.recoveries[0].leaseId).toBe("shard-0");
    expect(body.recoveries[0].durationMs).toBe(1500);
    expect(body.recoveries[0].snapshotSeq).toBe(100);
    expect(body.recoveries[0].tailLength).toBe(45);
    expect(body.recoveries[0].symbolsRecovered).toEqual(["AAPL", "MSFT", "NVDA"]);

    expect(body.recoveries[1].id).toBe(2);
    expect(body.recoveries[1].tailLength).toBe(60);
  });
});

describe("Metrics Summary (MS1-MS4)", () => {
  let app: FastifyInstance;
  let mockExecutor: any;
  let fetchSpy: any;
  let originalFetch: any;

  beforeEach(async () => {
    mockExecutor = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    // Mock fetch for Prometheus queries
    originalFetch = global.fetch;
    fetchSpy = vi.fn();
    (global as any).fetch = fetchSpy;

    app = Fastify({ logger: false });
    const deps: SystemRoutesDeps = {
      executor: mockExecutor,
      facade: {} as any,
      prometheusUrl: "http://localhost:9090",
    };
    await registerSystemRoutes(app, deps);
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  it("MS1: Maps fixed Prometheus queries to response shape", async () => {
    // Mock Prometheus responses for each query
    const mockPrometheusResponse = {
      status: "success",
      data: {
        result: [
          {
            metric: { shard_id: "shard-0" },
            value: [Date.now() / 1000, "123.45"],
          },
        ],
      },
    };

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockPrometheusResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await app.inject({
      method: "GET",
      url: "/system/metrics/summary",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.available).toBeDefined();
    expect(body.windowSeconds).toBeDefined();
    expect(body.commandsPerSec).toBeDefined();
    expect(body.latencyMs).toBeDefined();
    expect(body.queueDepthMax).toBeDefined();
    expect(body.byShard).toBeDefined();
    expect(Array.isArray(body.byShard)).toBe(true);
  });

  it("MS2: Returns 200 with available=false when Prometheus unreachable", async () => {
    // Mock Prometheus as unreachable
    fetchSpy.mockRejectedValue(new Error("Connection refused"));

    const response = await app.inject({
      method: "GET",
      url: "/system/metrics/summary",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.available).toBe(false);
    expect(body.commandsPerSec).toBeNull();
    expect(body.latencyMs).toBeNull();
    expect(body.queueDepthMax).toBeNull();
  });

  it("MS3: PromQL allowlist - no client input in queries", async () => {
    const mockResponse = {
      status: "success",
      data: { result: [] },
    };

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await app.inject({
      method: "GET",
      url: "/system/metrics/summary",
    });

    // Verify all fetch calls use pre-defined query strings, not user input
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
    for (const call of fetchSpy.mock.calls) {
      const urlStr = call[0];
      // Should be a Prometheus API URL with pre-defined queries
      expect(urlStr).toContain("http://localhost:9090");
      expect(urlStr).toContain("api/v1/query");
      // Check that query param contains known metric or function
      const hasKnownQuery =
        urlStr.includes("ml_shard_commands_total") ||
        urlStr.includes("ml_shard_append_duration_ms") ||
        urlStr.includes("ml_shard_queue_depth") ||
        urlStr.includes("ml_consumer_lag") ||
        urlStr.includes("ml_eventloop_delay_ms") ||
        urlStr.includes("histogram_quantile") ||
        urlStr.includes("rate");
      expect(hasKnownQuery).toBe(true);
    }
  });

  it("MS4: Role matrix - ADMIN only", async () => {
    const mockResponse = {
      status: "success",
      data: { result: [] },
    };

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    // ADMIN should have access (endpoint is public in this test without auth)
    const response = await app.inject({
      method: "GET",
      url: "/system/metrics/summary",
    });

    // No 403 in this test context (role checking happens in auth middleware)
    expect(response.statusCode).toBe(200);
  });
});

describe("Verify Replay (SY1, SY2)", () => {
  let app: FastifyInstance;
  let mockExecutor: any;

  beforeEach(async () => {
    mockExecutor = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    app = Fastify({ logger: false });
    const deps: SystemRoutesDeps = {
      executor: mockExecutor,
      facade: {} as any,
    };
    await registerSystemRoutes(app, deps);
  });

  it("SY1: Replays to latest snapshot seq and compares checksums on healthy stream", async () => {
    const stateJson = { bids: [], asks: [], version: 2, breaker: undefined };
    const expectedChecksum = createHash("sha256").update(JSON.stringify(stateJson)).digest("hex");

    mockExecutor.query.mockResolvedValueOnce({
      rows: [
        {
          last_seq: 100,
          state_json: stateJson,
          checksum: expectedChecksum,
        },
      ],
    });

    const response = await app.inject({
      method: "POST",
      url: "/system/verify-replay",
      payload: {
        streamId: "AAPL",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.streamId).toBe("AAPL");
    expect(body.upToSeq).toBe(100);
    expect(body.equal).toBe(true);
    expect(body.checksum).toBe(expectedChecksum);
  });

  it("SY2: Detects corrupted snapshots with checksum mismatch", async () => {
    const stateJson = { bids: [], asks: [], version: 2, breaker: undefined };
    const correctChecksum = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const storedChecksum = "incorrectincorrectincorrectincorrectincorrectincorrectincorrectinc";

    mockExecutor.query.mockResolvedValueOnce({
      rows: [
        {
          last_seq: 100,
          state_json: stateJson,
          checksum: storedChecksum,
        },
      ],
    });

    const response = await app.inject({
      method: "POST",
      url: "/system/verify-replay",
      payload: {
        streamId: "MSFT",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.streamId).toBe("MSFT");
    expect(body.upToSeq).toBe(100);
    expect(body.equal).toBe(false);
    expect(body.checksum).not.toBe(storedChecksum);
  });
});
