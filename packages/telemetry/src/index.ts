export {
  METRICS_CATALOGUE,
  getOrCreateCounter,
  getOrCreateHistogram,
  getOrCreateGauge,
  getRegistry,
  validateMetricName,
  type MetricDefinition,
  type MetricType,
} from "./registry.js";

export { startMetricsServer, type MetricsServerOptions } from "./server.js";
export { startEventLoopSampler, type EventLoopSamplerOptions } from "./eventloop-sampler.js";
