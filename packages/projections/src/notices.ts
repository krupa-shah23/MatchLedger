/**
 * Projection notices emitted after commit.
 * Used by WebSocket gateway to push updates to clients.
 */

export type ProjectionNotice =
  | { type: "ORDER_CHANGED"; orderId: string; status: string }
  | { type: "BALANCE_CHANGED"; accountId: string }
  | { type: "POSITION_CHANGED"; accountId: string; symbol: string }
  | { type: "RESERVATION_CHANGED"; orderId: string }
  | { type: "REJECTION_ADDED"; rejectionId: number }
  | { type: "BREAKER_CHANGED"; symbol: string }
  | { type: "TRADE_EXECUTED"; symbol: string };

/**
 * In-process notice bus.
 * Notices emitted only after projector transaction commits.
 */
export class NoticeBus {
  private listeners: Set<(notice: ProjectionNotice) => void> = new Set();

  subscribe(fn: (notice: ProjectionNotice) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(notice: ProjectionNotice): void {
    for (const fn of this.listeners) {
      fn(notice);
    }
  }
}
