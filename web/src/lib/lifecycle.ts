/**
 * Derive the visual lifecycle state of an order.
 * Returns a state suitable for rendering LifecycleStrip component.
 * Hand-written per WEEK-11.md section 4.10
 *
 * Lifecycle stages:
 * 1. JOURNALED (202 received, not yet accepted) → spinner + "durably received, not yet accepted"
 * 2. ACCEPTED (under consideration) → spinner + "pending" (after PENDING_HINT_MS)
 * 3. RESTING (in the book) → "resting"
 * 4. FILLED or PARTIALLY_FILLED → "filled qty/total"
 * 5. CANCELLED → "cancelled by you"
 * 6. REJECTED → "rejected: reason"
 */

export const PENDING_HINT_MS = 3000; // Show hint after 3 seconds

export type OrderStatus =
  | "RECEIVED"
  | "ACCEPTED"
  | "RESTING"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "REJECTED";

export interface Order {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  filledQty: string;
  status: OrderStatus;
  createdAt: string;
  terminalReason?: string | null;
}

export type LifecycleState =
  | { stage: "journaled"; spinner: true; text: string }
  | { stage: "accepted"; spinner: boolean; text: string; hint: boolean }
  | { stage: "resting"; spinner: false; text: string }
  | { stage: "filled"; spinner: false; text: string }
  | { stage: "cancelled"; spinner: false; text: string }
  | { stage: "rejected"; spinner: false; text: string; reason: string };

export function deriveLifecycle(order: Order, now: number): LifecycleState {
  const createdTime = new Date(order.createdAt).getTime();
  const ageMs = now - createdTime;

  switch (order.status) {
    case "RECEIVED":
      return {
        stage: "journaled",
        spinner: true,
        text: "durably received, not yet accepted",
      };

    case "ACCEPTED":
      const showHint = ageMs > PENDING_HINT_MS;
      return {
        stage: "accepted",
        spinner: true,
        text: showHint ? "pending" : "accepted",
        hint: showHint,
      };

    case "RESTING":
      return {
        stage: "resting",
        spinner: false,
        text: "resting in the book",
      };

    case "PARTIALLY_FILLED":
      const filledNum = Number(order.filledQty);
      const qtyNum = Number(order.quantity);
      const pct = qtyNum > 0 ? Math.round((filledNum / qtyNum) * 100) : 0;
      return {
        stage: "filled",
        spinner: false,
        text: `${order.filledQty} of ${order.quantity} filled (${pct}%)`,
      };

    case "FILLED":
      return {
        stage: "filled",
        spinner: false,
        text: `${order.quantity} filled`,
      };

    case "CANCEL_REQUESTED":
      return {
        stage: "accepted",
        spinner: true,
        text: "cancelling",
        hint: false,
      };

    case "CANCELLED":
      return {
        stage: "cancelled",
        spinner: false,
        text: "cancelled by you",
      };

    case "REJECTED":
      return {
        stage: "rejected",
        spinner: false,
        text: "rejected",
        reason: order.terminalReason || "unknown reason",
      };

    default:
      return {
        stage: "journaled",
        spinner: true,
        text: "unknown state",
      };
  }
}
