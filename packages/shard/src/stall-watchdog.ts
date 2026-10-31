import { Worker } from "node:worker_threads";

/** A separate thread must stop native Kafka heartbeats while the JS loop stalls.
 * A timer on the blocked loop cannot enforce max.poll.interval.ms. */
export function startStallWatchdog(timeoutMs: number) {
  const memory = new SharedArrayBuffer(BigInt64Array.BYTES_PER_ELEMENT);
  const beat = new BigInt64Array(memory);
  Atomics.store(beat, 0, BigInt(Date.now()));
  const worker = new Worker(new URL("./stall-watchdog-worker.js", import.meta.url), {
    workerData: { memory, timeoutMs, pid: process.pid },
  });
  const timer = setInterval(() => Atomics.store(beat, 0, BigInt(Date.now())), Math.min(100, timeoutMs / 4));
  return async () => { clearInterval(timer); await worker.terminate(); };
}
