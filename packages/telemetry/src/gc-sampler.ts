import { PerformanceObserver } from "node:perf_hooks";
import { getOrCreateHistogram } from "./registry.js";

/** Observe actual GC performance entries and publish their durations in milliseconds. */
export function startGcSampler(): () => void {
  const pauses = getOrCreateHistogram("ml_gc_pause_ms");
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (Number.isFinite(entry.duration) && entry.duration >= 0) pauses.observe({}, entry.duration);
    }
  });
  observer.observe({ entryTypes: ["gc"] });
  return () => observer.disconnect();
}
