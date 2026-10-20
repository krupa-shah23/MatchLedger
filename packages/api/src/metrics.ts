/**
 * Metrics integration: wire API metrics to telemetry package
 * Tracks order lifecycle, WebSocket connections, consumer lag, and breaker state
 */

import { getOrCreateHistogram, getOrCreateCounter, getOrCreateGauge, startMetricsServer } from '@matchledger/telemetry';

/**
 * Record order lifecycle timestamp (journaled → accepted → resting → filled).
 * Called when order state changes; calculates elapsed time from journal timestamp.
 */
export function recordOrderLifecycle(startTs: number, nowMs: number): void {
  const elapsedMs = nowMs - startTs;
  const histogram = getOrCreateHistogram('ml_order_lifecycle_ms');
  histogram.observe({}, elapsedMs);
}

/**
 * Record WebSocket connection event.
 */
export function recordWebSocketConnection(symbol: string, connected: boolean): void {
  const counter = getOrCreateCounter('ml_websocket_connections');
  counter.inc({ symbol, action: connected ? 'open' : 'close' });
}

/**
 * Record WebSocket message.
 */
export function recordWebSocketMessage(symbol: string): void {
  const counter = getOrCreateCounter('ml_websocket_messages_total');
  counter.inc({ symbol });
}

/**
 * Update consumer lag (max offset - committed offset).
 */
export function setConsumerLag(lag: number): void {
  const gauge = getOrCreateGauge('ml_consumer_lag');
  gauge.set({}, lag);
}

/**
 * Update projector lag (snapshot_seq - committed).
 */
export function setProjectorLag(lag: number): void {
  const gauge = getOrCreateGauge('ml_projector_lag');
  gauge.set({}, lag);
}

/**
 * Update circuit breaker state.
 */
export function setBreakerState(symbol: string, state: 'CLOSED' | 'OPEN' | 'HALTED'): void {
  const stateValue = state === 'CLOSED' ? 0 : state === 'OPEN' ? 1 : 2;
  const gauge = getOrCreateGauge('ml_breaker_state');
  gauge.set({ symbol }, stateValue);
}

/**
 * Update dedupe set size.
 */
export function setDedupeSetSize(size: number): void {
  const gauge = getOrCreateGauge('ml_dedupe_set_size');
  gauge.set({}, size);
}

/**
 * Update invariant gauges (ledger zero-sum, journal monotonic).
 */
export function setInvariantLedgerZeroSum(isZero: boolean): void {
  const gauge = getOrCreateGauge('ml_invariant_ledger_zero_sum');
  gauge.set({}, isZero ? 1 : 0);
}

export function setInvariantJournalMonotonic(isMonotonic: boolean): void {
  const gauge = getOrCreateGauge('ml_invariant_journal_monotonic');
  gauge.set({}, isMonotonic ? 1 : 0);
}

export { startMetricsServer } from '@matchledger/telemetry';
