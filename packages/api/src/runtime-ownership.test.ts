import { it, expect, vi, afterEach } from "vitest";
import { acquireRuntimeOwnership, API_OWNERSHIP_LOCK } from "./runtime-ownership.js";

afterEach(() => vi.useRealTimers());

it("waits for the previous owner and only succeeds once the lock is available", async () => {
  const query = vi.fn().mockResolvedValueOnce({ rows: [{ locked: false }] }).mockResolvedValueOnce({ rows: [{ locked: false }] }).mockResolvedValueOnce({ rows: [{ locked: true }] });
  const onWaiting = vi.fn();
  await acquireRuntimeOwnership({ query }, { timeoutMs: 1000, retryMs: 1, onWaiting });
  expect(query).toHaveBeenCalledTimes(3);
  expect(query).toHaveBeenLastCalledWith("SELECT pg_try_advisory_lock($1) AS locked", [API_OWNERSHIP_LOCK]);
  expect(onWaiting).toHaveBeenCalledTimes(1);
});

it("fails explicitly when a live owner does not release the lock", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [{ locked: false }] });
  await expect(acquireRuntimeOwnership({ query }, { timeoutMs: 5, retryMs: 1, onWaiting: vi.fn() })).rejects.toThrow("Stop the previous API instance");
  expect(query.mock.calls.every(([sql]) => sql === "SELECT pg_try_advisory_lock($1) AS locked")).toBe(true);
});

it("propagates a disconnected database instead of continuing startup", async () => {
  const query = vi.fn().mockRejectedValue(new Error("connection lost"));
  await expect(acquireRuntimeOwnership({ query }, { timeoutMs: 1000, retryMs: 1, onWaiting: vi.fn() })).rejects.toThrow("connection lost");
  expect(query).toHaveBeenCalledTimes(1);
});
