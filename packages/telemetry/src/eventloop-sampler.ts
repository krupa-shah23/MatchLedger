/**
 * Event-loop delay sampler using perf_hooks.monitorEventLoopDelay.
 * Publishes ml_eventloop_delay_ms histogram.
 */

import { monitorEventLoopDelay } from "node:perf_hooks";
import { getOrCreateHistogram } from "./registry.js";

export interface EventLoopSamplerOptions {
  resolution?: number; // milliseconds between samples
  processLabel?: string;
}

export function startEventLoopSampler(opts: EventLoopSamplerOptions = {}): () => void {
  const resolution = opts.resolution || 10;
  const processLabel = opts.processLabel || "default";
  const histogram = getOrCreateHistogram("ml_eventloop_delay_ms");

  const monitor = monitorEventLoopDelay({ resolution });
  monitor.enable();

  const interval = setInterval(() => {
    const delay = Math.round(monitor.mean / 1000000); // Convert nanoseconds to milliseconds
    if (delay > 0) {
      histogram.observe({ process: processLabel }, delay);
    }
  }, resolution * 10); // Sample every 10x resolution

  return () => {
    clearInterval(interval);
    monitor.disable();
  };
}
