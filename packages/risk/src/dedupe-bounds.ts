/**
 * Dedupe bounds for RiskState (Week 10, task 5.7).
 * Keep live order ids forever, plus ids decided within DEDUPE_WINDOW_SEQ.
 * Evict older decided ids when snapshots are written.
 * Record window floor in snapshot for recovery.
 */

export interface DedupeBounds {
  windowFloor: number; // Seq from last snapshot; ids below this were evicted
  windowSeq: number; // DEDUPE_WINDOW_SEQ config (e.g., 100,000)
}

/**
 * Check if an orderId should be kept in the dedupe set.
 * Keep if:
 * 1. Order is live (has a reservation)
 * 2. Order was decided within the window (lastDecidedSeq - windowSeq <= decidedSeq)
 */
export function shouldKeepOrderId(
  orderId: string,
  isLive: boolean,
  decidedSeq: number,
  lastDecidedSeq: number,
  windowSeq: number
): boolean {
  // Live orders are never evicted
  if (isLive) {
    return true;
  }

  // Decided orders: keep if within window
  // Window = [lastDecidedSeq - windowSeq, lastDecidedSeq]
  const windowStart = lastDecidedSeq - windowSeq;
  return decidedSeq >= windowStart && decidedSeq <= lastDecidedSeq;
}

/**
 * Evict old decided ids when snapshot is written.
 * Sets windowFloor to lastDecidedSeq, which becomes the recovery point.
 */
export function evictOldIds(
  decidedIds: Map<string, { decidedSeq: number; isLive: boolean }>,
  lastDecidedSeq: number,
  windowSeq: number
): { evicted: number; floor: number } {
  let evicted = 0;
  const windowStart = lastDecidedSeq - windowSeq;

  for (const [orderId, { decidedSeq, isLive }] of decidedIds.entries()) {
    if (!isLive && decidedSeq < windowStart) {
      decidedIds.delete(orderId);
      evicted++;
    }
  }

  return { evicted, floor: lastDecidedSeq };
}

/**
 * Upcaster for RiskState snapshot version bump.
 * Converts old snapshot (no window floor) to new format with bounds.
 */
export function upcasterV1toV2(oldSnapshot: Record<string, unknown>): Record<string, unknown> {
  return {
    ...oldSnapshot,
    dedupeBounds: {
      windowFloor: 0, // Fresh snapshot assumes floor at 0
      windowSeq: 100000, // Default DEDUPE_WINDOW_SEQ
    },
  };
}

/**
 * RiskState version management for dedupe bounds.
 */
export const RISK_STATE_VERSION = 2; // Bumped from 1 to 2 for Week 10

export const RISK_STATE_UPCASTERS = {
  1: upcasterV1toV2,
  // Future versions: 2 -> 3, etc.
};
