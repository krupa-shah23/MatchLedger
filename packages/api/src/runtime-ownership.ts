import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";

export const API_OWNERSHIP_LOCK = 713110;

/** Wait for the previous owner to finish; never evict a live writer. */
export async function acquireRuntimeOwnership(
  connection: { query(sql: string, params: unknown[]): Promise<{ rows: { locked: boolean }[] }> },
  options: { timeoutMs: number; retryMs: number; onWaiting: () => void },
): Promise<void> {
  const deadline = performance.now() + options.timeoutMs;
  let reported = false;
  while (true) {
    const result = await connection.query("SELECT pg_try_advisory_lock($1) AS locked", [API_OWNERSHIP_LOCK]);
    if (result.rows[0]?.locked) return;
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new Error(
      "Database ownership wait timed out. Stop the previous API instance before deploying this single-writer service; Render overlapping deploys keep it alive until the replacement is healthy.",
    );
    if (!reported) { options.onWaiting(); reported = true; }
    await delay(Math.min(options.retryMs, remaining));
  }
}
