import { describe, expect, it } from "vitest";
import { buildBenchmarkMetrics, collectPrometheusWindow, type PrometheusFetcher } from "./collect.js";

describe("Prometheus range collector", () => {
  it("uses only fixed catalogue queries and confines query ranges to the supplied measurement window", async () => {
    const requested: URL[] = [];
    const fetcher: PrometheusFetcher = async (input) => {
      const url = new URL(input);
      requested.push(url);
      const query = url.searchParams.get("query") ?? "";
      const metric = query.includes("reason") ? { reason: "INSUFFICIENT_BALANCE" } : {};
      return new Response(JSON.stringify({
        status: "success",
        data: { result: [{ metric, values: [[200, "1"]] }] },
      }), { status: 200 });
    };
    const collected = await collectPrometheusWindow({ baseUrl: "http://prometheus:9090", startMs: 100_000, endMs: 200_000, stepMs: 10_000, fetcher });

    expect(requested.length).toBeGreaterThan(0);
    expect(requested.every((url) => url.pathname === "/api/v1/query_range")).toBe(true);
    expect(requested.every((url) => url.searchParams.get("start") === "100")).toBe(true);
    expect(requested.every((url) => url.searchParams.get("end") === "200")).toBe(true);
    expect(requested.every((url) => url.searchParams.get("query")?.startsWith("sum(") || url.searchParams.get("query")?.startsWith("histogram_quantile(") || url.searchParams.get("query")?.startsWith("max_over_time(") || url.searchParams.get("query")?.startsWith("sum by (reason)") )).toBe(true);
    expect(collected.rejectionCountsByReason).toHaveProperty("INSUFFICIENT_BALANCE");
    expect(collected.latencyMs.p99).toBeDefined();
    expect(collected.eventLoopDelayMs.max).toBeDefined();
    const runnerMetrics = buildBenchmarkMetrics(collected, { sent: 1, dropped_iterations: 0, errors: { total: 0, byCode: {} } });
    expect(runnerMetrics).toHaveProperty("accepted");
    expect(runnerMetrics).toHaveProperty("latencyMs");
    expect(runnerMetrics).toHaveProperty("gcPauseTotalMs");
    expect(runnerMetrics.sent).toBe(1);
  });

  it("rejects an empty or reversed measure window before querying Prometheus", async () => {
    let called = false;
    const fetcher: PrometheusFetcher = async () => { called = true; return new Response("{}", { status: 200 }); };
    await expect(collectPrometheusWindow({ baseUrl: "http://prometheus:9090", startMs: 200, endMs: 100, stepMs: 10, fetcher })).rejects.toThrow("finite increasing timestamps");
    expect(called).toBe(false);
  });
});
