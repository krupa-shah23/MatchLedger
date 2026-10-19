/**
 * Facts extracted from journal records for an order.
 * Status is derived from these facts at read time, not stored.
 */
export type OrderFacts = {
  quantity: bigint;
  accepted: boolean;
  rested: boolean;
  filledQty: bigint;
  terminal: "CANCELLED" | "REJECTED" | null;
  cancelRequested: boolean;
  hasCommand: boolean;
};

export type OrderStatus = "RECEIVED" | "ACCEPTED" | "RESTING" | "PARTIALLY_FILLED" | "FILLED" | "CANCEL_REQUESTED" | "CANCELLED" | "REJECTED";

/**
 * Derives order status from facts in order-independent manner.
 * Precedence: terminal REJECTED > fill equals qty > terminal CANCELLED > cancelRequested > fill > rested > accepted > else RECEIVED
 * Impossible fact sets (filledQty > quantity) throw.
 */
export function deriveOrderStatus(facts: OrderFacts): OrderStatus {
  // Validate impossible states
  if (facts.filledQty > facts.quantity) {
    throw new Error(`Impossible: filledQty (${facts.filledQty}) > quantity (${facts.quantity})`);
  }

  // Precedence: terminal REJECTED
  if (facts.terminal === "REJECTED") return "REJECTED";

  // Fill equals quantity (beats cancel and other states)
  if (facts.filledQty === facts.quantity) return "FILLED";

  // Terminal CANCELLED
  if (facts.terminal === "CANCELLED") return "CANCELLED";

  // Cancel requested
  if (facts.cancelRequested) return "CANCEL_REQUESTED";

  // Partially filled
  if (facts.filledQty > 0n) return "PARTIALLY_FILLED";

  // Resting
  if (facts.rested) return "RESTING";

  // Accepted
  if (facts.accepted) return "ACCEPTED";

  // Default: received (not accepted yet)
  return "RECEIVED";
}
