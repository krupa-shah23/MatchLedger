/** Fixed-query Prometheus collection limited to a caller-supplied measurement window. */

export interface CollectedPrometheusMetrics {
  accepted: number;
  rejected: number;
  acceptedOrdersPerSecond: number;
  latencyMs: { p50: number; p95: number; p99: number };
  eventLoopDelayMs: { p99: number; max: number };
  gcPauseTotalMs: number;
  queueDepthMax: number;
  fullCount: number;
  consumerLagMax: number;
  rejectionCountsByReason: Record<string, number>;
}

interface PrometheusPoint { timestamp: number; value: number }
interface PrometheusSeries { metric: Record<string, string>; values?: Array<[number, string]>; value?: [number, string] }
interface PrometheusResponse { status: string; error?: string; data?: { result?: PrometheusSeries[] } }
export type PrometheusFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface LoadWindowCounts {
  sent: number;
  dropped_iterations: number;
  errors: { total: number; byCode: Record<string, number> };
}

function readPoints(series: PrometheusSeries): PrometheusPoint[] {
  const raw = series.values ?? (series.value ? [series.value] : []);
  return raw.map(([timestamp, value]) => ({ timestamp: Number(timestamp), value: Number(value) }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value));
}

function lastValue(series: PrometheusSeries | undefined): number | undefined {
  const points = series ? readPoints(series) : [];
  return points.at(-1)?.value;
}

function latestScalar(series: PrometheusSeries[]): number | undefined {
  const values = series.map(lastValue).filter((value): value is number => value !== undefined);
  return values.length ? values.reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY) : undefined;
}

function latestSum(series: PrometheusSeries[]): number | undefined {
  const values = series.map(lastValue).filter((value): value is number => value !== undefined);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

/**
 * PromQL expressions are an internal fixed allowlist. Only measurement timestamps
 * and step are provided by the caller; they cannot supply or alter a query.
 */
export async function collectPrometheusWindow(options: {
  baseUrl: string;
  startMs: number;
  endMs: number;
  stepMs: number;
  fetcher?: PrometheusFetcher;
}): Promise<CollectedPrometheusMetrics> {
  if (!Number.isFinite(options.startMs) || !Number.isFinite(options.endMs) || options.endMs <= options.startMs) {
    throw new Error("Prometheus measurement window must have finite increasing timestamps");
  }
  if (!Number.isFinite(options.stepMs) || options.stepMs <= 0) throw new Error("Prometheus stepMs must be positive");
  const windowSeconds = (options.endMs - options.startMs) / 1000;
  const queries = {
    accepted: `sum(increase(ml_risk_decisions_total{outcome="accepted"}[${windowSeconds}s]))`,
    rejected: `sum(increase(ml_risk_decisions_total{outcome="rejected"}[${windowSeconds}s]))`,
    acceptedRate: `sum(rate(ml_risk_decisions_total{outcome="accepted"}[${windowSeconds}s]))`,
    lifecycleP50: `histogram_quantile(0.50, sum by (le) (increase(ml_order_lifecycle_ms_bucket[${windowSeconds}s])))`,
    lifecycleP95: `histogram_quantile(0.95, sum by (le) (increase(ml_order_lifecycle_ms_bucket[${windowSeconds}s])))`,
    lifecycleP99: `histogram_quantile(0.99, sum by (le) (increase(ml_order_lifecycle_ms_bucket[${windowSeconds}s])))`,
    eventLoopP99: `histogram_quantile(0.99, sum by (le) (increase(ml_eventloop_delay_ms_bucket[${windowSeconds}s])))`,
    eventLoopMax: `max_over_time(ml_eventloop_delay_max_ms[${windowSeconds}s])`,
    gcPause: `sum(increase(ml_gc_pause_ms_sum[${windowSeconds}s]))`,
    queueDepth: `max_over_time(ml_shard_queue_depth[${windowSeconds}s])`,
    fullCount: `sum(increase(ml_shard_queue_full[${windowSeconds}s]))`,
    consumerLag: `max_over_time(ml_consumer_lag[${windowSeconds}s])`,
    rejections: `sum by (reason) (increase(ml_risk_rejections_total[${windowSeconds}s]))`,
  } as const;
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const start = (options.startMs / 1000).toString();
  const end = (options.endMs / 1000).toString();
  const step = (options.stepMs / 1000).toString();
  const entries = await Promise.all(Object.entries(queries).map(async ([name, query]) => {
    const url = new URL(`${baseUrl}/api/v1/query_range`);
    url.searchParams.set("query", query);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    url.searchParams.set("step", step);
    const response = await fetcher(url.toString());
    if (!response.ok) throw new Error(`Prometheus ${name} query returned HTTP ${response.status}`);
    const body = await response.json() as PrometheusResponse;
    if (body.status !== "success" || !body.data?.result) throw new Error(`Prometheus ${name} query failed: ${body.error ?? "missing result"}`);
    return [name, body.data.result] as const;
  }));
  const result = Object.fromEntries(entries) as Record<keyof typeof queries, PrometheusSeries[]>;

  const accepted = latestSum(result.accepted);
  const rejected = latestSum(result.rejected);
  const acceptedOrdersPerSecond = latestSum(result.acceptedRate);
  const latency = [latestScalar(result.lifecycleP50), latestScalar(result.lifecycleP95), latestScalar(result.lifecycleP99)];
  const eventLoopP99 = latestScalar(result.eventLoopP99);
  const eventLoopMax = latestScalar(result.eventLoopMax);
  if (accepted === undefined || rejected === undefined || acceptedOrdersPerSecond === undefined
    || latency.some((value) => value === undefined) || eventLoopMax === undefined) {
    throw new Error("Prometheus measurement window is missing risk, lifecycle or event-loop series");
  }
  const rejectionCountsByReason = Object.fromEntries(result.rejections.flatMap((series) => {
    const value = lastValue(series);
    const reason = series.metric.reason;
    return value !== undefined && reason ? [[reason, Math.max(0, Math.round(value))]] : [];
  }));

  return {
    accepted: Math.max(0, Math.round(accepted)),
    rejected: Math.max(0, Math.round(rejected)),
    acceptedOrdersPerSecond: Math.max(0, acceptedOrdersPerSecond),
    latencyMs: { p50: latency[0]!, p95: latency[1]!, p99: latency[2]! },
    eventLoopDelayMs: { p99: eventLoopP99 ?? 0, max: eventLoopMax },
    gcPauseTotalMs: Math.max(0, latestSum(result.gcPause) ?? 0),
    queueDepthMax: Math.max(0, Math.round(latestScalar(result.queueDepth) ?? 0)),
    fullCount: Math.max(0, Math.round(latestSum(result.fullCount) ?? 0)),
    consumerLagMax: Math.max(0, Math.round(latestScalar(result.consumerLag) ?? 0)),
    rejectionCountsByReason,
  };
}

/** Attach generator/k6 counters and Prometheus measurements in the runner schema shape. */
export function buildBenchmarkMetrics(
  prometheus: CollectedPrometheusMetrics,
  load: LoadWindowCounts,
) {
  return {
    ...load,
    accepted: prometheus.accepted,
    rejected: prometheus.rejected,
    acceptedOrdersPerSecond: prometheus.acceptedOrdersPerSecond,
    latencyMs: prometheus.latencyMs,
    eventLoopDelayMs: prometheus.eventLoopDelayMs,
    gcPauseTotalMs: prometheus.gcPauseTotalMs,
    queueDepthMax: prometheus.queueDepthMax,
    fullCount: prometheus.fullCount,
    consumerLagMax: prometheus.consumerLagMax,
    rejectionCountsByReason: prometheus.rejectionCountsByReason,
  };
}
