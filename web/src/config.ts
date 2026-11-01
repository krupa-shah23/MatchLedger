import { DEFAULT_PENDING_HINT_MS, DEFAULT_POLL_INTERVAL_MS } from "./config-defaults.js";
export { DEFAULT_PENDING_HINT_MS, DEFAULT_POLL_INTERVAL_MS } from "./config-defaults.js";

function positiveInteger(raw: string | undefined, fallback: number, name: string): number {
  const value = raw === undefined ? fallback : +raw;
  if (raw?.trim() === "" || !globalThis.isFinite(value) || value <= 0 || value % 1 !== 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function readWebConfig(env: { VITE_PENDING_HINT_MS?: string; VITE_POLL_INTERVAL_MS?: string }) {
  return {
    pendingHintMs: positiveInteger(env.VITE_PENDING_HINT_MS, DEFAULT_PENDING_HINT_MS, "VITE_PENDING_HINT_MS"),
    pollIntervalMs: positiveInteger(env.VITE_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS, "VITE_POLL_INTERVAL_MS"),
  };
}

export const webConfig = readWebConfig(import.meta.env);

/** Ignore accidental whitespace in the deployment profile without enabling demo by default. */
export function isDemoProfile(value: string | undefined): boolean {
  return value?.trim() === "demo";
}
