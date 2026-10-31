/**
 * Event-loop delay sampler using perf_hooks.monitorEventLoopDelay.
 * Publishes ml_eventloop_delay_ms histogram.
 */

import { monitorEventLoopDelay } from "node:perf_hooks";
import { getOrCreateGauge, getOrCreateHistogram } from "./registry.js";

export interface EventLoopSamplerOptions {
  resolution?: number; // milliseconds between samples
  processLabel?: string;
}

export function startEventLoopSampler(opts: EventLoopSamplerOptions = {}): () => void {
  const resolution = opts.resolution || 10;
  const processLabel = opts.processLabel || "default";
  const histogram = getOrCreateHistogram("ml_eventloop_delay_ms");
  const maximum = getOrCreateGauge("ml_eventloop_delay_max_ms");

  const monitor = monitorEventLoopDelay({ resolution });
  monitor.enable();

  const interval = setInterval(() => {
    const p99 = Math.round(monitor.percentile(99) / 1000000);
    const max = Math.round(monitor.max / 1000000);
    if (Number.isFinite(p99) && p99 > 0) {
      histogram.observe({ process: processLabel }, p99);
    }
    maximum.set({ process: processLabel }, Number.isFinite(max) ? max : 0);
    monitor.reset();
  }, resolution * 10); // Sample every 10x resolution

  return () => {
    clearInterval(interval);
    monitor.disable();
  };
}
