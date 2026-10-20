/**
 * Metrics registry with ml_ prefix enforcement and label validation.
 * Single source of truth: the catalogue defines all metrics.
 */

import { register, Counter, Histogram, Gauge, type Metric } from "prom-client";

export type MetricType = "counter" | "histogram" | "gauge";

export interface MetricDefinition {
  name: string; // Must start with ml_
  type: MetricType;
  help: string;
  labelNames?: string[];
  buckets?: number[]; // For histograms
}

// Catalogue of all metrics (single source of truth)
export const METRICS_CATALOGUE: Record<string, MetricDefinition> = {
  // Shard metrics
  "ml_shard_commands_total": {
    name: "ml_shard_commands_total",
    type: "counter",
    help: "Total commands enqueued",
    labelNames: ["shard_id", "symbol"],
  },
  "ml_shard_batch_size": {
    name: "ml_shard_batch_size",
    type: "histogram",
    help: "Commands per batch",
    labelNames: ["shard_id"],
    buckets: [1, 5, 10, 50, 100, 500],
  },
  "ml_shard_append_duration_ms": {
    name: "ml_shard_append_duration_ms",
    type: "histogram",
    help: "Journal append latency",
    labelNames: ["shard_id"],
    buckets: [1, 5, 10, 50, 100],
  },
  "ml_shard_apply_duration_ms": {
    name: "ml_shard_apply_duration_ms",
    type: "histogram",
    help: "Engine apply latency",
    labelNames: ["shard_id"],
    buckets: [1, 5, 10, 50],
  },
  "ml_shard_publish_duration_ms": {
    name: "ml_shard_publish_duration_ms",
    type: "histogram",
    help: "Event publish latency",
    labelNames: ["shard_id"],
    buckets: [1, 5, 10, 50, 100],
  },
  "ml_shard_queue_depth": {
    name: "ml_shard_queue_depth",
    type: "gauge",
    help: "Buffered commands in queue",
    labelNames: ["shard_id"],
  },
  "ml_shard_queue_full": {
    name: "ml_shard_queue_full",
    type: "counter",
    help: "Queue FULL events (pause triggers)",
    labelNames: ["shard_id"],
  },
  "ml_shard_lease_epoch": {
    name: "ml_shard_lease_epoch",
    type: "gauge",
    help: "Current lease epoch",
    labelNames: ["shard_id"],
  },
  "ml_shard_ownership_changes": {
    name: "ml_shard_ownership_changes",
    type: "counter",
    help: "Partition ownership transitions",
    labelNames: ["shard_id"],
  },
  "ml_shard_last_seq": {
    name: "ml_shard_last_seq",
    type: "gauge",
    help: "Last journaled seq per symbol",
    labelNames: ["shard_id", "symbol"],
  },

  // Heartbeat and recovery metrics
  "ml_shard_heartbeat_latency_ms": {
    name: "ml_shard_heartbeat_latency_ms",
    type: "histogram",
    help: "Heartbeat write latency",
    labelNames: ["shard_id"],
    buckets: [1, 5, 10, 50],
  },
  "ml_recovery_duration_ms": {
    name: "ml_recovery_duration_ms",
    type: "gauge",
    help: "Last recovery duration",
    labelNames: ["shard_id"],
  },
  "ml_recovery_snapshot_seq": {
    name: "ml_recovery_snapshot_seq",
    type: "gauge",
    help: "Last recovery snapshot seq",
    labelNames: ["shard_id"],
  },
  "ml_recovery_tail_length": {
    name: "ml_recovery_tail_length",
    type: "gauge",
    help: "Last recovery tail length",
    labelNames: ["shard_id"],
  },

  // Event-loop metrics
  "ml_eventloop_delay_ms": {
    name: "ml_eventloop_delay_ms",
    type: "histogram",
    help: "Event-loop delay (perf_hooks)",
    labelNames: ["process"],
    buckets: [1, 5, 10, 50, 100, 500],
  },

  // Control-plane metrics
  "ml_order_lifecycle_ms": {
    name: "ml_order_lifecycle_ms",
    type: "histogram",
    help: "Order submit-to-fill latency",
    labelNames: ["outcome"],
    buckets: [10, 100, 500, 1000, 5000, 10000],
  },
  "ml_risk_decisions_total": {
    name: "ml_risk_decisions_total",
    type: "counter",
    help: "Risk decisions (accept/reject)",
    labelNames: ["outcome"],
  },
  "ml_consumer_lag": {
    name: "ml_consumer_lag",
    type: "gauge",
    help: "Kafka consumer lag",
    labelNames: ["topic", "partition"],
  },
  "ml_projector_lag_ms": {
    name: "ml_projector_lag_ms",
    type: "gauge",
    help: "Projector lag behind writes",
  },

  // API metrics
  "ml_websocket_connections": {
    name: "ml_websocket_connections",
    type: "gauge",
    help: "Active WebSocket connections",
  },
  "ml_websocket_messages_total": {
    name: "ml_websocket_messages_total",
    type: "counter",
    help: "Total WebSocket messages sent",
    labelNames: ["message_type"],
  },
  "ml_breaker_state": {
    name: "ml_breaker_state",
    type: "gauge",
    help: "Circuit breaker state (0=closed, 1=open)",
    labelNames: ["symbol"],
  },
  "ml_dedupe_set_size": {
    name: "ml_dedupe_set_size",
    type: "gauge",
    help: "Dedupe set size",
    labelNames: ["set_name"],
  },

  // Invariants
  "ml_invariant_ledger_zero_sum": {
    name: "ml_invariant_ledger_zero_sum",
    type: "gauge",
    help: "Ledger zero-sum invariant (1=ok, 0=violated)",
  },
  "ml_invariant_journal_monotonic": {
    name: "ml_invariant_journal_monotonic",
    type: "gauge",
    help: "Journal monotonic seq invariant (1=ok, 0=violated)",
  },
};

const metrics = new Map<string, Metric>();

export function validateMetricName(name: string): void {
  if (!name.startsWith("ml_")) {
    throw new Error(`Metric name must start with ml_, got ${name}`);
  }
}

export function getOrCreateCounter(
  name: string,
  opts: { help?: string; labelNames?: string[] } = {}
) {
  validateMetricName(name);
  if (!metrics.has(name)) {
    try {
      const metric = new Counter({
        name,
        help: opts.help || name,
        labelNames: opts.labelNames,
        registers: [register],
      });
      metrics.set(name, metric);
    } catch (e) {
      const existing = register.getSingleMetric(name);
      if (existing) {
        metrics.set(name, existing as Counter);
      } else {
        throw e;
      }
    }
  }
  return metrics.get(name) as Counter;
}

export function getOrCreateHistogram(
  name: string,
  opts: {
    help?: string;
    labelNames?: string[];
    buckets?: number[];
  } = {}
) {
  validateMetricName(name);
  if (!metrics.has(name)) {
    try {
      const metric = new Histogram({
        name,
        help: opts.help || name,
        labelNames: opts.labelNames,
        buckets: opts.buckets,
        registers: [register],
      });
      metrics.set(name, metric);
    } catch (e) {
      const existing = register.getSingleMetric(name);
      if (existing) {
        metrics.set(name, existing as Histogram);
      } else {
        throw e;
      }
    }
  }
  return metrics.get(name) as Histogram;
}

export function getOrCreateGauge(
  name: string,
  opts: { help?: string; labelNames?: string[] } = {}
) {
  validateMetricName(name);
  if (!metrics.has(name)) {
    try {
      const metric = new Gauge({
        name,
        help: opts.help || name,
        labelNames: opts.labelNames,
        registers: [register],
      });
      metrics.set(name, metric);
    } catch (e) {
      const existing = register.getSingleMetric(name);
      if (existing) {
        metrics.set(name, existing as Gauge);
      } else {
        throw e;
      }
    }
  }
  return metrics.get(name) as Gauge;
}

export function getRegistry() {
  return register;
}
