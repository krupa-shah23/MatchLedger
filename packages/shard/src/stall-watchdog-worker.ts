import { writeSync } from "node:fs";
import { workerData } from "node:worker_threads";

const { memory, timeoutMs, pid } = workerData as { memory: SharedArrayBuffer; timeoutMs: number; pid: number };
const beat = new BigInt64Array(memory);
setInterval(() => {
  if (Date.now() - Number(Atomics.load(beat, 0)) > timeoutMs) {
    writeSync(2, "Shard event loop stalled; fail-stop before continuing with stale ownership\n");
    process.kill(pid, "SIGKILL");
  }
}, Math.min(100, timeoutMs / 4));
