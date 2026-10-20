/**
 * Fixed PromQL query allowlist for metrics/summary endpoint.
 * No user input is ever inserted into these queries.
 */

export interface MetricsQueryResult {
  commandsPerSec: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
  queueDepthMax: number | null;
  consumerLagMax: number | null;
  eventLoopP99Ms: number | null;
  byShardCommands: Array<{ shard_id: string; rate: number }>;
}

/**
 * Fetch metrics from Prometheus and map to summary response.
 * Returns graceful default if Prometheus is unreachable.
 */
export async function fetchMetricsSummary(prometheusUrl: string): Promise<MetricsQueryResult> {
  try {
    // Query all metrics in parallel
    const [
      commandsPerSec,
      latencyP50,
      latencyP95,
      latencyP99,
      queueDepthMax,
      consumerLagMax,
      eventLoopP99,
      byShardCommands,
    ] = await Promise.all([
      queryPrometheus(prometheusUrl, 'rate(ml_shard_commands_total[1m])'),
      queryPrometheus(prometheusUrl, 'histogram_quantile(0.50, ml_shard_append_duration_ms)'),
      queryPrometheus(prometheusUrl, 'histogram_quantile(0.95, ml_shard_append_duration_ms)'),
      queryPrometheus(prometheusUrl, 'histogram_quantile(0.99, ml_shard_append_duration_ms)'),
      queryPrometheus(prometheusUrl, 'max(ml_shard_queue_depth)'),
      queryPrometheus(prometheusUrl, 'max(ml_consumer_lag)'),
      queryPrometheus(prometheusUrl, 'histogram_quantile(0.99, ml_eventloop_delay_ms)'),
      queryPrometheusRange(
        prometheusUrl,
        'rate(ml_shard_commands_total[1m])'
      ),
    ]);

    // Aggregate commands per second across all shards
    const totalCommandsPerSec = Object.values(commandsPerSec as any).reduce(
      (sum: number, val: any) => sum + (typeof val === 'number' ? val : 0),
      0
    );

    return {
      commandsPerSec: totalCommandsPerSec,
      latencyP50Ms: latencyP50 as number | null,
      latencyP95Ms: latencyP95 as number | null,
      latencyP99Ms: latencyP99 as number | null,
      queueDepthMax: queueDepthMax as number | null,
      consumerLagMax: consumerLagMax as number | null,
      eventLoopP99Ms: eventLoopP99 as number | null,
      byShardCommands: (byShardCommands as any[]).map((item: any) => ({
        shard_id: item.shard_id || item.label_shard_id,
        rate: item.value || 0,
      })),
    };
  } catch (err) {
    // Prometheus unreachable or error - return nulls but indicate available: false
    return {
      commandsPerSec: null,
      latencyP50Ms: null,
      latencyP95Ms: null,
      latencyP99Ms: null,
      queueDepthMax: null,
      consumerLagMax: null,
      eventLoopP99Ms: null,
      byShardCommands: [],
    };
  }
}

/**
 * Query Prometheus for a single scalar value (safe, no user input).
 */
async function queryPrometheus(prometheusUrl: string, query: string): Promise<number | null> {
  const url = new URL('/api/v1/query', prometheusUrl);
  url.searchParams.set('query', query);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Prometheus query failed: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  if (data.status !== 'success' || !data.data?.result) {
    return null;
  }

  const result = data.data.result[0];
  if (!result || !result.value || result.value.length < 2) {
    return null;
  }

  return parseFloat(result.value[1]);
}

/**
 * Query Prometheus for range of values with labels (safe, no user input).
 */
async function queryPrometheusRange(
  prometheusUrl: string,
  query: string
): Promise<Array<{ shard_id: string; value: number }>> {
  const url = new URL('/api/v1/query', prometheusUrl);
  url.searchParams.set('query', query);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Prometheus query failed: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  if (data.status !== 'success' || !data.data?.result) {
    return [];
  }

  return (data.data.result as any[]).map((result: any) => ({
    shard_id: result.metric?.shard_id || 'unknown',
    value: parseFloat(result.value?.[1] || 0),
  }));
}
